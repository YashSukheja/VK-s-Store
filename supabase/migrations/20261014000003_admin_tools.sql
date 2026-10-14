-- VK's Store: admin tools (pack 3)
-- A SALE tag the admin can switch on per product, and a quick +/- stock
-- change from the products list that can't race with booking confirmations.

alter table public.products
  add column on_sale boolean not null default false;

-- Adds (or with a negative number, removes) pieces of one size. Never goes
-- below zero. Returns the new stock.
create function public.admin_adjust_stock(p_size_id uuid, p_change int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change stock' using errcode = '42501';
  end if;
  if p_change is null or abs(p_change) > 1000 then
    raise exception 'Change stock by up to 1000 at a time' using errcode = '22023';
  end if;
  update public.product_sizes
  set stock = greatest(0, stock + p_change)
  where id = p_size_id
  returning stock into v_stock;
  if v_stock is null then
    raise exception 'Size not found' using errcode = 'P0002';
  end if;
  return v_stock;
end;
$$;

revoke execute on function public.admin_adjust_stock(uuid, int) from public, anon;
grant execute on function public.admin_adjust_stock(uuid, int) to authenticated;
