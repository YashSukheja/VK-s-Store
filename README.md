# VK's Store

A mobile-first shop website for VK's Store: customers browse clothes by category, see sizes and stock, and contact VK on WhatsApp. VK manages products, photos, size stock, categories and store details from a private admin area.

Built with React + TypeScript + Tailwind CSS (Vite), with Supabase for the database, logins and photo storage. Everything runs on free plans.

## What's built (phases 2 to 4: catalog, customer accounts, bookings, admin bookings)

- **Shop** (`/`): category bar on phones, sidebar on larger screens; "Only N left" and "Sold out" labels.
- **Product page** (`/p/:id`): swipeable photos, MRP and saving, size buttons with stock, quantity, Add to cart.
- **Customers**: create an account with username, mobile and password (`/register`); log in with username or mobile (`/login`). Supabase needs an email per login, so each customer gets a private placeholder address (`c-<random>@customers.vks-store.invalid`) they never see.
- **Cart and booking** (`/cart`): cart kept on the phone; pickup or delivery, cash or UPI, a note. The database checks stock and sets prices. Each booking gets a code like `VK-1001` and starts as "Waiting for VK"; stock is taken off when VK confirms (phase 4). A customer can have 3 waiting bookings at most.
- **Admin bookings** (`/admin/bookings`): Waiting / Confirmed / Done, with a count badge on the tab (refreshed every minute). Confirm takes the stock off, with the size rows locked so the last piece can't be confirmed twice; cards warn when stock is short or other waiting bookings want the same piece. Reject, Cancel (puts stock back), Mark collected/delivered. A "Tell customer" WhatsApp button follows each change.
- **48-hour auto-cancel**: a `pg_cron` job (`vks-auto-cancel-bookings`, every 15 minutes) cancels bookings still waiting after 48 hours.
- **Phone alerts**: Admin > Settings > Phone alerts creates a private channel for the free ntfy app; every new booking sends the booking code and total (no customer details) through `pg_net`.
- **Customers** (`/admin/customers`): contacts, booking counts, and "Set a new password" for customers who forgot theirs.
- **After booking** (`/bookings/:code`): "Send to VK on WhatsApp" opens WhatsApp with the booking ID, customer, items, sizes, quantities, prices, total and time. `/account` lists the customer's bookings and statuses.
- **Admin** (`/admin`): email + password, then a 6-digit code from an authenticator app (Google Authenticator). Products with up to 8 photos (shrunk on the phone before upload), size stock, show/hide; categories with size lists; store settings (WhatsApp number, UPI ID, pickup address).

Security lives in the database: visitors can only read visible items, and only the admin account, after the authenticator step, can change anything (see `supabase/migrations`).

## Run it locally

Needs Node 20+ and Docker.

```bash
npm install
npx supabase start          # local database, auth and storage
cp .env.example .env.local  # then paste the local URL and anon key that `supabase start` prints
npm run dev
```

Tests (with the local stack running):

```bash
npm run test:db    # database security rules
npm run test:e2e   # resets the local database, then browser tests: admin setup, adding products, shopping
```

## Put it online (one-time setup)

1. **Supabase**: create a project (region: Mumbai). In Authentication > Sign In / Providers, keep Email on and turn **off** "Confirm email" (customer sign-up needs this). In Authentication > Multi-Factor, make sure **TOTP (authenticator app)** is enabled.
2. **Database**: link and push the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Admin account**: in Supabase, Authentication > Users > Add user, with VK's email and a long password (tick "Auto confirm"). Then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'VK_EMAIL_HERE');
   ```
   On first login at `/admin`, VK scans a QR code with Google Authenticator.
4. **Cloudflare**: Workers & Pages > Create > import this GitHub repo (deploy command `npx wrangler deploy`). `wrangler.jsonc` builds the site and serves `dist/`; its `name` must match the Worker's name. The public Supabase URL and publishable key are in `.env.production`.

## Project layout

```
src/
  pages/            Shop, Product, admin/*
  components/       shared UI
  data/catalog.ts   database reads
  lib/              Supabase client, auth, formatting, photo compression
supabase/migrations tables, rules and storage
tests/              database security tests
e2e/                browser tests
```
