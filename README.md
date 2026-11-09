# Coinhabi

A private, USD-first personal finance workspace. Track investments across US
stocks, Taiwan stocks, crypto, cash, and watch-only public wallet addresses —
then layer on cashflow, recurring bills, debts, budgets, and financial-health
guidance. Works on desktop and mobile, in five languages.

> Not investment advice. Prices come from free public endpoints and are for
> personal tracking only.

## Features

**Portfolio**
- US stocks, Taiwan stocks, crypto, and cash in one USD-normalized view
- Manual holdings plus watch-only wallet tracking (public addresses only)
- Live prices: Yahoo Finance (stocks), CoinGecko (crypto), FX rate for TWD
- Symbol search for stocks (Finnhub) and crypto (CoinGecko)
- Allocation donut, leaders/laggards, and a "today's movers" panel that breaks
  the daily change down per holding
- Bulk import holdings from an Excel/CSV file (downloadable template,
  auto column detection, editable preview before saving)

**Cashflow & planning**
- Income/expense tracking with a monthly calendar and spending-by-category
- Recurring expenses and subscriptions (monthly/yearly, annualized cost)
- Debts/loans with minimum payments and payoff tracking
- Monthly budgets per category
- Private financial-health guidance based on cashflow, debt, budgets, and data quality

**Experience**
- Responsive desktop layout and a dedicated mobile UI
- Light/dark theme
- Five languages: English, 中文, 日本語, 한국어, Español (selectable on the
  login page and in-app)
- Custom portfolio name synced across devices
- Read-only demo at `/demo` (no login required)
- Optional private-beta email allowlist

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL with Row Level Security for per-user isolation
- Recharts for charts, SheetJS (`xlsx`) for import
- Reown AppKit + wagmi/viem for read-only wallet connection
- Capacitor for the iOS/Android shells

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   # Optional: comma-separated private-beta allowlist. Blank = any signed-in user.
   ALLOWED_EMAILS=your@email.com,friend@email.com
   FINNHUB_API_KEY=...
   NEXT_PUBLIC_REOWN_PROJECT_ID=...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Run the Supabase SQL migrations in order (`supabase/migrations/`):

   | File | Adds |
   |------|------|
   | `0001_initial_schema.sql` | Holdings table + RLS |
   | `0002_wallet_tracking.sql` | Wallet accounts, holding source columns |
   | `0003_evm_networks.sql` | Extra EVM chains |
   | `0004_bitcoin_xpub_tracking.sql` | Bitcoin xpub support |
   | `0005_cashflow_transactions.sql` | Income/expense records |
   | `0006_recurring_expenses.sql` | Recurring bills |
   | `0007_subscription_management.sql` | Subscription fields |
   | `0008_debts.sql` | Debts/loans |
   | `0009_monthly_budgets.sql` | Per-category budgets |
   | `0010_user_settings.sql` | Cross-device settings (portfolio name) |
   | `0011_multi_currency_total_budget.sql` | Multi-currency total budgets |
   | `0012_display_currency.sql` | Cross-device display currency |
   | `0014_holding_break_even_price.sql` | Broker break-even price for net P/L calculations |
   | `0015_holding_gain_calculation_mode.sql` | Confirmed or estimated holding gain calculation mode |
   | `0017_investment_transactions.sql` | Investment history, realized P/L, and atomic sale recording |
   | `0018_global_stock_markets.sql` | Global stock market metadata, currencies, and lot sizes |

4. Start the app:

   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run i18n:check` | Check for missing translation keys |
| `npm run mobile:sync` | `cap sync` the web build into the native shells |
| `npm run mobile:ios` / `mobile:android` | Open the native projects |

## Supabase notes

- Use Supabase Auth with email + password.
- Set the Auth `Site URL` to your production URL and add
  `https://your-domain.example/auth/confirm` to the allowed redirect URLs.
- Keep email confirmation enabled for public registration. The app accepts both
  token-hash and PKCE confirmation callbacks at `/auth/confirm`.
- Enable RLS on all user-data tables and keep `Enable Data API` on.
- To enable self-service account deletion, add `SUPABASE_SERVICE_ROLE_KEY` to
  your local environment and Vercel environment variables. This server-only
  secret is never exposed to the browser.

## Watch-only wallet tracking

Only public addresses are accepted — seed phrases, private keys, and PINs are
never requested or stored.

- **EVM** (Ethereum, Base, Arbitrum One, OP Mainnet, Polygon PoS): native coin
  and ERC-20 balances via Blockscout
- **Bitcoin**: balance via mempool.space; supports a single address or
  xpub/ypub/zpub account tracking (receive + change derivation, gap limit 20)
- **Solana**: SOL and SPL balances via Solana RPC
- **Cardano**: ADA and native assets via Koios (`stake1...` is more complete
  than a single `addr1...`)

Optional endpoint overrides: `ETHEREUM_BLOCKSCOUT_URL`, `BASE_BLOCKSCOUT_URL`,
`ARBITRUM_BLOCKSCOUT_URL`, `OPTIMISM_BLOCKSCOUT_URL`, `POLYGON_BLOCKSCOUT_URL`,
`BITCOIN_API_URL`, `SOLANA_RPC_URL`, `CARDANO_KOIOS_URL`.

### Wallet connection (Reown AppKit)

The address-tracking page can connect EVM, Solana, and Bitcoin wallets to import
a public address read-only; the user still confirms before it is saved.

1. Create a free project at [Reown Cloud](https://cloud.reown.com/).
2. Put the Project ID in `NEXT_PUBLIC_REOWN_PROJECT_ID`.
3. Set `NEXT_PUBLIC_APP_URL` to the local or deployed URL, then restart.

## Import holdings from Excel

On the desktop **Holdings → Excel import** tab: download the template or upload
any `.xlsx`/`.csv`. Columns (type, symbol, name, quantity, average cost,
currency) are auto-detected, mapping can be corrected, and every row is
previewed and editable before a batch insert.

## Localization

UI strings resolve through `tx()` in `lib/i18n.ts`, backed by
`lib/translations.ts` and `lib/translation-overrides.json`, with English
fallback for any untranslated phrase. Run `npm run i18n:check` to find gaps.

## Mobile app

The web app is wrapped with Capacitor (`ios/`, `android/`). The native shell
loads the deployed URL; run `npm run mobile:sync` after building, then open the
platform project to build in Xcode / Android Studio.

## Deployment

Deployed on Vercel. Set the same environment variables in the Vercel project.
Because the connected Git identity is not a member of the Vercel team, pushes do
not auto-deploy; ship with the CLI instead:

```bash
npx vercel --prod
```

## Exchange-rate reliability

Live conversions require a complete, validated USD-based rate set from ExchangeRate-API.
The app shows the provider's update time (not the portfolio refresh time). Rates older
than 36 hours or reused after a failed request are explicitly marked as estimates.
The latest successful rates are kept in server memory and in this browser's local
storage (`coinhabi.fx.v1`), so they can be reused after a server cold start. Browser
storage contains only public exchange rates, not holdings or credentials; it is not
shared across devices and can be cleared by the browser. If no valid rates are
available, the app shows a retry screen instead of portfolio totals.

Run exchange-rate failure/recovery checks with `node --test tests/fx.test.mjs`.
