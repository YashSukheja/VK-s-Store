-- VK's Store: grow the store (pack 4)
-- Customers can ask to be told when a sold-out size is back. Store settings
-- get an Instagram handle and opening hours for the shop footer.

alter table public.store_settings
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column store_hours text check (store_hours is null or length(store_hours) <= 120);

create table public.stock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, size, customer_id)
);

create index stock_requests_open on public.stock_requests (product_id) where notified_at is null;

alter table public.stock_requests enable row level security;
create policy "customers see their own requests, admin sees all" on public.stock_requests
  for select to authenticated using (customer_id = auth.uid() or public.is_admin());
create policy "customers remove their own requests, admin any" on public.stock_requests
  for delete to authenticated using (customer_id = auth.uid() or public.is_admin());
create policy "admin marks requests as told" on public.stock_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, delete on public.stock_requests to authenticated;
grant update (notified_at) on public.stock_requests to authenticated;

-- Ask to be told when a sold-out size is back. Only for customers, only for
-- sizes that are really sold out, and at most 20 open requests each.
create function public.request_restock(p_product_id uuid, p_size text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Log in with a customer account first' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.product_sizes ps
    join public.products p on p.id = ps.product_id
    join public.categories c on c.id = p.category_id
    where ps.product_id = p_product_id and ps.size = p_size and ps.stock = 0 and p.is_visible and c.is_visible
  ) then
    raise exception 'That size is in stock or no longer in the shop' using errcode = '22023';
  end if;
  if (select count(*) from public.stock_requests where customer_id = auth.uid() and notified_at is null) >= 20 then
    raise exception 'You already have 20 requests waiting' using errcode = '22023';
  end if;
  -- Asking again after being told re-opens the request.
  insert into public.stock_requests (product_id, size, customer_id)
  values (p_product_id, p_size, auth.uid())
  on conflict (product_id, size, customer_id)
  do update set notified_at = null, created_at = now();
end;
$$;

revoke execute on function public.request_restock(uuid, text) from public, anon;
grant execute on function public.request_restock(uuid, text) to authenticated;
