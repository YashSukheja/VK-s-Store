# VK's Store

A mobile-first shop website for VK's Store: customers browse clothes by category, see sizes and stock, and contact VK on WhatsApp. VK manages products, photos, size stock, categories and store details from a private admin area.

Built with React + TypeScript + Tailwind CSS (Vite), with Supabase for the database, logins and photo storage. Everything runs on free plans.

## What's built (phase 2: catalog)

- **Shop** (`/`): category bar on phones, sidebar on larger screens; "Only N left" and "Sold out" labels.
- **Product page** (`/p/:id`): swipeable photos, MRP and saving, size buttons with stock, quantity, "Book on WhatsApp" with a filled-in message.
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

1. **Supabase**: create a project (region: Mumbai). In Authentication > Sign In / Providers, keep Email on and turn **off** "Confirm email". In Authentication > Multi-Factor, make sure **TOTP (authenticator app)** is enabled.
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
4. **Cloudflare Pages**: create a project from this GitHub repo.
   - Build command: `npm run build`
   - Output folder: `dist`
   - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API).
   `public/_redirects` sends every page to the app so links like `/p/...` work.

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
