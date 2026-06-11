# Financial Tracker App

A private portfolio dashboard for tracking crypto, Taiwan stocks, US stocks, and cash in a USD-first view.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL
- Supabase RLS for per-user data isolation
- Free market data endpoints through a server route

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ALLOWED_EMAIL=your@email.com
   ```

3. Run the Supabase SQL migration in `supabase/migrations/0001_initial_schema.sql`.

4. Start the app:

   ```bash
   npm run dev
   ```

## Supabase Notes

- Use Supabase Auth with email + password.
- Enable RLS on user data tables.
- Keep `Enable Data API` enabled.
- Disable `Automatically expose new tables` if you want to manage API access manually.
- `Enable automatic RLS` is recommended for future tables.

The first version assumes a single allowed email through `ALLOWED_EMAIL`, while still storing data with `user_id` so the app can support more users later.
