-- VK's Store: customer accounts and bookings (phase 3)
-- Customers sign up with a username, mobile number and password. Supabase
-- needs an email for each login, so the app makes a private placeholder one;
-- customers never see it and log in with their username or mobile.

-- ---------------------------------------------------------------------------
-- Sign-up and login helpers
-- ---------------------------------------------------------------------------

-- Tells the sign-up form which of username / mobile are already taken, so it
-- can say so instead of failing with a database error.
create function public.signup_check(p_username text, p_mobile text)
returns table (username_taken boolean, mobile_taken boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.profiles where username = lower(trim(p_username))),
    exists (select 1 from public.profiles where mobile = trim(p_mobile));
$$;

-- Finds the login email for a customer's username or mobile. Only customer
-- accounts are matched, so this never reveals the admin's email.
create function public.customer_login_email(p_login text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'customer'
    and (p.username = lower(trim(p_login)) or p.mobile = trim(p_login))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create sequence public.booking_number_seq start 1001;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('VK-' || nextval('public.booking_number_seq')),
  customer_id uuid references public.profiles (id) on delete set null,
  -- Copied at booking time so the admin keeps the contact even if the account goes.
  customer_username text not null,
  customer_mobile text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'rejected', 'cancelled')),
  fulfilment text not null check (fulfilment in ('pickup', 'delivery')),
  delivery_address text check (delivery_address is null or length(delivery_address) between 5 and 300),
  payment_method text not null check (payment_method in ('cash', 'upi')),
  note text not null default '' check (length(note) <= 300),
  total int not null check (total > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_needs_address check (fulfilment = 'pickup' or delivery_address is not null)
);

create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_status_idx on public.bookings (status, created_at desc);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  -- Name, size and price as they were when booked.
  product_name text not null,
  size text not null,
  quantity int not null check (quantity between 1 and 5),
  price int not null check (price > 0)
);

create index booking_items_booking_idx on public.booking_items (booking_id);

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Place a booking. Prices and stock come from the database, never from the
-- phone. Stock is only checked here; it is taken off when VK confirms.
-- p_items: [{"product_id":"…","size":"M","quantity":1}, ...]
-- ---------------------------------------------------------------------------
create function public.place_booking(
  p_items jsonb,
  p_fulfilment text,
  p_delivery_address text,
  p_payment_method text,
  p_note text
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_booking public.bookings;
  v_item record;
  v_total int := 0;
  v_address text := nullif(trim(coalesce(p_delivery_address, '')), '');
begin
  select * into v_profile from public.profiles where profiles.id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'customer' or v_profile.mobile is null then
    raise exception 'Log in with a customer account to book' using errcode = '42501';
  end if;

  if (select count(*) from public.bookings b where b.customer_id = v_profile.id and b.status = 'pending') >= 3 then
    raise exception 'You already have 3 bookings waiting. VK will confirm them soon.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'Too many items in one booking' using errcode = '22023';
  end if;
  if p_fulfilment not in ('pickup', 'delivery') or p_payment_method not in ('cash', 'upi') then
    raise exception 'Choose pickup or delivery, and cash or UPI' using errcode = '22023';
  end if;
  if p_fulfilment = 'delivery' and (v_address is null or length(v_address) < 5) then
    raise exception 'Add a delivery address' using errcode = '22023';
  end if;

  for v_item in
    with cart_lines as (
      -- Same product and size twice in the cart counts as one line.
      select (i ->> 'product_id')::uuid as product_id,
             trim(i ->> 'size') as size,
             sum((i ->> 'quantity')::int)::int as quantity,
             min(o) as sort_order
      from jsonb_array_elements(p_items) with ordinality as x(i, o)
      group by 1, 2
    )
    select c.product_id, c.size, c.quantity, p.name, p.price, s.stock
    from cart_lines c
    left join public.products p
      on p.id = c.product_id
     and p.is_visible
     and exists (select 1 from public.categories cat where cat.id = p.category_id and cat.is_visible)
    left join public.product_sizes s on s.product_id = p.id and s.size = c.size
    order by c.sort_order
  loop
    if v_item.name is null or v_item.stock is null then
      raise exception 'An item in your cart is no longer available' using errcode = 'P0001';
    end if;
    if v_item.quantity < 1 or v_item.quantity > 5 then
      raise exception 'You can book 1 to 5 of each item' using errcode = '22023';
    end if;
    if v_item.quantity > v_item.stock then
      raise exception 'Only % left of % in size %', v_item.stock, v_item.name, v_item.size using errcode = 'P0001';
    end if;
    v_total := v_total + v_item.price * v_item.quantity;
  end loop;

  insert into public.bookings (customer_id, customer_username, customer_mobile, fulfilment,
                               delivery_address, payment_method, note, total)
  values (v_profile.id, v_profile.username, v_profile.mobile, p_fulfilment,
          case when p_fulfilment = 'delivery' then v_address end,
          p_payment_method, left(trim(coalesce(p_note, '')), 300), v_total)
  returning * into v_booking;

  insert into public.booking_items (booking_id, product_id, product_name, size, quantity, price)
  select v_booking.id, c.product_id, p.name, c.size, c.quantity, p.price
  from (
    select (i ->> 'product_id')::uuid as product_id,
           trim(i ->> 'size') as size,
           sum((i ->> 'quantity')::int)::int as quantity,
           min(o) as sort_order
    from jsonb_array_elements(p_items) with ordinality as x(i, o)
    group by 1, 2
  ) c
  join public.products p on p.id = c.product_id
  order by c.sort_order;

  return query select v_booking.id, v_booking.code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: customers see only their own bookings; the admin sees
-- all. Nobody writes bookings directly; place_booking does it.
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;

create policy "own bookings or admin" on public.bookings
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

create policy "items of readable bookings" on public.booking_items
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

grant select on public.bookings, public.booking_items to authenticated;

revoke execute on function public.place_booking(jsonb, text, text, text, text) from public, anon;
grant execute on function public.place_booking(jsonb, text, text, text, text) to authenticated;
revoke execute on function public.signup_check(text, text) from public;
grant execute on function public.signup_check(text, text) to anon, authenticated;
revoke execute on function public.customer_login_email(text) from public;
grant execute on function public.customer_login_email(text) to anon, authenticated;
