-- VK's Store: admin bookings (phase 4)
-- Confirming takes stock off (locked, so two confirmations can't sell the
-- same last piece). Waiting bookings cancel themselves after 48 hours. New
-- bookings can ping VK's phone through the free ntfy app. The admin can set a
-- new password for a customer who forgot theirs.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.bookings
  add column auto_cancelled boolean not null default false,
  add column status_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Change a booking's status
--   waiting   -> confirmed (takes stock off), rejected, cancelled
--   confirmed -> completed, cancelled (puts stock back)
-- ---------------------------------------------------------------------------
create function public.admin_set_booking_status(p_booking_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change bookings' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not (
    (v_booking.status = 'pending' and p_status in ('confirmed', 'rejected', 'cancelled'))
    or (v_booking.status = 'confirmed' and p_status in ('completed', 'cancelled'))
  ) then
    raise exception 'A % booking can''t be marked %', v_booking.status, p_status using errcode = '22023';
  end if;

  if p_status = 'confirmed' then
    -- Lock the size rows first so a second confirmation waits its turn.
    perform 1
    from public.product_sizes ps
    join public.booking_items bi on bi.product_id = ps.product_id and bi.size = ps.size
    where bi.booking_id = p_booking_id
    order by ps.id
    for update of ps;

    for v_item in
      select bi.product_name, bi.size, bi.quantity, ps.id as size_id, ps.stock
      from public.booking_items bi
      left join public.product_sizes ps on ps.product_id = bi.product_id and ps.size = bi.size
      where bi.booking_id = p_booking_id
    loop
      if v_item.size_id is null then
        raise exception '% (size %) has been removed from the shop. Reject this booking instead.', v_item.product_name, v_item.size
          using errcode = 'P0001';
      end if;
      if v_item.stock < v_item.quantity then
        raise exception 'Not enough stock: % left of % in size %, booking needs %.', v_item.stock, v_item.product_name, v_item.size, v_item.quantity
          using errcode = 'P0001';
      end if;
    end loop;

    update public.product_sizes ps
    set stock = ps.stock - bi.quantity
    from public.booking_items bi
    where bi.booking_id = p_booking_id and ps.product_id = bi.product_id and ps.size = bi.size;
  end if;

  if v_booking.status = 'confirmed' and p_status = 'cancelled' then
    -- Put the pieces back on the shelf (if the item and size still exist).
    update public.product_sizes ps
    set stock = ps.stock + bi.quantity
    from public.booking_items bi
    where bi.booking_id = p_booking_id and ps.product_id = bi.product_id and ps.size = bi.size;
  end if;

  update public.bookings
  set status = p_status, status_changed_at = now()
  where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 48-hour auto-cancel, run every 15 minutes by pg_cron.
-- ---------------------------------------------------------------------------
create function public.auto_cancel_old_bookings()
returns int
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.bookings
    set status = 'cancelled', auto_cancelled = true, status_changed_at = now()
    where status = 'pending' and created_at < now() - interval '48 hours'
    returning 1
  )
  select count(*)::int from done;
$$;

select cron.schedule('vks-auto-cancel-bookings', '*/15 * * * *', 'select public.auto_cancel_old_bookings()');

-- ---------------------------------------------------------------------------
-- Admin-only settings (never readable by shoppers).
-- ntfy_topic: the private ntfy.sh channel VK's phone listens to.
-- ---------------------------------------------------------------------------
create table public.admin_settings (
  id int primary key default 1 check (id = 1),
  ntfy_topic text check (ntfy_topic is null or ntfy_topic ~ '^[A-Za-z0-9_-]{20,64}$')
);

insert into public.admin_settings (id) values (1);

alter table public.admin_settings enable row level security;
create policy "admin reads alert settings" on public.admin_settings
  for select to authenticated using (public.is_admin());
create policy "admin updates alert settings" on public.admin_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.admin_settings to authenticated;

-- The ntfy message, or null when no channel is set.
create function public.phone_alert_body(p_title text, p_message text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('topic', ntfy_topic, 'title', p_title, 'message', p_message,
                            'tags', jsonb_build_array('shopping_bags'), 'priority', 4)
  from public.admin_settings
  where id = 1 and ntfy_topic is not null;
$$;

-- Sends a short alert to VK's phone. Only the booking code, total and
-- pickup/delivery go to ntfy; no customer details.
create function public.send_phone_alert(p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body jsonb := public.phone_alert_body(p_title, p_message);
begin
  if v_body is not null then
    perform net.http_post(url := 'https://ntfy.sh/', body := v_body);
  end if;
end;
$$;

create function public.notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_phone_alert(
    'New booking ' || new.code,
    'Total ₹' || new.total || ' · ' || case when new.fulfilment = 'pickup' then 'Pickup' else 'Delivery' end
      || '. Open the admin to confirm.'
  );
  return new;
end;
$$;

create trigger bookings_notify after insert on public.bookings
  for each row execute function public.notify_new_booking();

create function public.admin_test_phone_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can send test alerts' using errcode = '42501';
  end if;
  perform public.send_phone_alert('VK''s Store test', 'Phone alerts are working.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Set a new password for a customer who forgot theirs.
-- ---------------------------------------------------------------------------
create function public.admin_reset_customer_password(p_customer_id uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can reset passwords' using errcode = '42501';
  end if;
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'The new password needs at least 8 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and role = 'customer') then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_customer_id;
  -- Log them out everywhere so the old password stops working at once.
  delete from auth.sessions where user_id = p_customer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_set_booking_status(uuid, text) from public, anon;
grant execute on function public.admin_set_booking_status(uuid, text) to authenticated;
revoke execute on function public.admin_reset_customer_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_customer_password(uuid, text) to authenticated;
revoke execute on function public.admin_test_phone_alert() from public, anon;
grant execute on function public.admin_test_phone_alert() to authenticated;
revoke execute on function public.auto_cancel_old_bookings() from public, anon, authenticated;
revoke execute on function public.send_phone_alert(text, text) from public, anon, authenticated;
revoke execute on function public.phone_alert_body(text, text) from public, anon, authenticated;
revoke execute on function public.notify_new_booking() from public, anon, authenticated;
