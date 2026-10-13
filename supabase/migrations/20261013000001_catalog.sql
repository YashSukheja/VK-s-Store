-- VK's Store: catalog (profiles, categories, products, photos, size stock, settings)
-- Prices are whole rupees. Stock never goes below zero.

-- ---------------------------------------------------------------------------
-- Profiles: one row per login. Role is never set by the app; the admin role
-- is granted by hand in SQL (see README).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  mobile text unique check (mobile ~ '^[6-9][0-9]{9}$'),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Create the profile when someone signs up. Username and mobile come from the
-- sign-up form's metadata. Accounts made in the Supabase dashboard (the admin)
-- get a placeholder username and no mobile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, mobile)
  values (
    new.id,
    coalesce(
      lower(new.raw_user_meta_data ->> 'username'),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    ),
    new.raw_user_meta_data ->> 'mobile'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True only for the admin, and only after the authenticator-app step (aal2).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Lets the admin login screen know whether this account is an admin, before
-- the second step is done. Says nothing about anyone else.
create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  sizes text[] not null default '{}',
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 1000),
  mrp int check (mrp is null or mrp > 0),
  price int not null check (price > 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mrp_not_below_price check (mrp is null or mrp >= price)
);

create index products_category_idx on public.products (category_id);
create index products_created_idx on public.products (created_at desc);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null check (length(trim(size)) between 1 and 10),
  stock int not null default 0 check (stock >= 0),
  sort_order int not null default 0,
  unique (product_id, size)
);

create index product_sizes_product_idx on public.product_sizes (product_id, sort_order);

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^[6-9][0-9]{9}$'),
  upi_id text check (upi_id is null or (length(upi_id) <= 100 and upi_id ~ '^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$')),
  pickup_address text check (pickup_address is null or length(pickup_address) <= 300),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Save a product and its size stock in one step. Runs as the caller, so the
-- admin-only rules below still apply.
-- p_sizes: [{"size":"M","stock":2}, ...] in display order. Sizes left out are
-- removed.
-- ---------------------------------------------------------------------------
create function public.admin_save_product(
  p_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_mrp int,
  p_price int,
  p_is_visible boolean,
  p_sizes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can save products' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.products (category_id, name, description, mrp, price, is_visible)
    values (p_category_id, trim(p_name), coalesce(p_description, ''), p_mrp, p_price, p_is_visible)
    returning id into v_id;
  else
    update public.products
    set category_id = p_category_id,
        name = trim(p_name),
        description = coalesce(p_description, ''),
        mrp = p_mrp,
        price = p_price,
        is_visible = p_is_visible
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.product_sizes ps
  where ps.product_id = v_id
    and ps.size not in (select s ->> 'size' from jsonb_array_elements(p_sizes) s);

  insert into public.product_sizes (product_id, size, stock, sort_order)
  select v_id, trim(s.value ->> 'size'), (s.value ->> 'stock')::int, (s.ordinality - 1)::int
  from jsonb_array_elements(p_sizes) with ordinality as s(value, ordinality)
  on conflict (product_id, size)
  do update set stock = excluded.stock, sort_order = excluded.sort_order;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: the public can read what's visible; only the admin
-- (after the authenticator step) can change anything.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sizes enable row level security;
alter table public.store_settings enable row level security;

create policy "own profile or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "admin updates profiles" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read visible categories" on public.categories
  for select to anon, authenticated
  using (is_visible or public.is_admin());
create policy "admin writes categories" on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read visible products" on public.products
  for select to anon, authenticated
  using (
    (is_visible and exists (
      select 1 from public.categories c where c.id = category_id and c.is_visible
    ))
    or public.is_admin()
  );
create policy "admin writes products" on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read images of readable products" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "admin writes images" on public.product_images
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read sizes of readable products" on public.product_sizes
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "admin writes sizes" on public.product_sizes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "anyone reads settings" on public.store_settings
  for select to anon, authenticated
  using (true);
create policy "admin updates settings" on public.store_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Explicit grants (new projects may not expose tables by default).
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images,
  public.product_sizes, public.store_settings to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.products,
  public.product_images, public.product_sizes to authenticated;
grant update on public.store_settings to authenticated;

revoke execute on function public.admin_save_product(uuid, uuid, text, text, int, int, boolean, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, uuid, text, text, int, int, boolean, jsonb) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Starting categories with their size lists (editable in the admin).
insert into public.categories (name, slug, sizes, sort_order) values
  ('Shirts', 'shirts', '{S,M,L,XL,XXL}', 1),
  ('T-shirts', 't-shirts', '{S,M,L,XL,XXL}', 2),
  ('Jeans', 'jeans', '{28,30,32,34,36,38}', 3),
  ('Trousers', 'trousers', '{28,30,32,34,36,38}', 4);
