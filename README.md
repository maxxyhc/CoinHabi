# Financial Tracker App

A private portfolio dashboard for tracking crypto, Taiwan stocks, US stocks, cash, and watch-only public wallet addresses in a USD-first view.

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
   # Optional: comma-separated private-beta allowlist.
   ALLOWED_EMAILS=your@email.com,friend@email.com
   FINNHUB_API_KEY=...
   NEXT_PUBLIC_REOWN_PROJECT_ID=...
   NEXT_PUBLIC_APP_URL=http://localhost:3021
   ```

3. Run the Supabase SQL migrations in order:

   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_wallet_tracking.sql`
   - `supabase/migrations/0003_evm_networks.sql`
   - `supabase/migrations/0004_bitcoin_xpub_tracking.sql`

4. Start the app:

   ```bash
   npm run dev
   ```

## Supabase Notes

- Use Supabase Auth with email + password.
- Set the Auth `Site URL` to the production website and add
  `https://your-domain.example/auth/confirm` to the allowed redirect URLs.
- Keep email confirmation enabled for public registration. The app accepts both
  token-hash and PKCE confirmation callbacks at `/auth/confirm`.
- Enable RLS on user data tables.
- Keep `Enable Data API` enabled.
- Disable `Automatically expose new tables` if you want to manage API access manually.
- `Enable automatic RLS` is recommended for future tables.

Use the optional comma-separated `ALLOWED_EMAILS` allowlist for a private beta. Leave it blank to allow every authenticated Supabase user. The legacy `ALLOWED_EMAIL` variable remains supported for existing deployments.

## Watch-only wallet tracking

- Ethereum, Base, Arbitrum One, OP Mainnet, and Polygon PoS: native coin and ERC-20 balances through Blockscout
- Bitcoin: BTC balance through mempool.space; supports both a single address and xpub/ypub/zpub account tracking
- Solana: SOL and SPL balances through Solana RPC
- Cardano: ADA and native assets through Koios; `stake1...` is recommended over one `addr1...` address
- Only public addresses are accepted. Seed phrases, private keys, and PINs are never requested or stored.

Optional endpoint overrides: `ETHEREUM_BLOCKSCOUT_URL`, `BASE_BLOCKSCOUT_URL`, `ARBITRUM_BLOCKSCOUT_URL`, `OPTIMISM_BLOCKSCOUT_URL`, `POLYGON_BLOCKSCOUT_URL`, `BITCOIN_API_URL`, `SOLANA_RPC_URL`, and `CARDANO_KOIOS_URL`.

## Wallet connection

The address tracking page can connect Ethereum, Base, Arbitrum One, OP Mainnet, Polygon PoS, Solana, and Bitcoin wallets through Reown AppKit. The connection is read-only: the app imports the public address and still requires the user to confirm before saving it as a tracked account.

1. Create a free project at [Reown Cloud](https://cloud.reown.com/).
2. Copy the Project ID into `NEXT_PUBLIC_REOWN_PROJECT_ID` in `.env.local`.
3. Set `NEXT_PUBLIC_APP_URL` to the local or deployed site URL.
4. Restart the app after changing environment variables.

Bitcoin wallet connections currently import the single address supplied by the wallet. For a more complete BTC account view, manually add the account `xpub`, `ypub`, or `zpub`; the app derives receive and change addresses with a gap limit of 20. Cardano remains available through manual `stake1...` or `addr1...` entry.

## Capacitor mobile app

The iOS and Android apps use Capacitor and load the deployed Financial Tracker
site so the web app, mobile app, Supabase data, and server APIs stay in sync.
Mobile screens use bottom navigation and card-based holdings while desktop keeps
the sidebar and tables.

Sync web assets and Capacitor configuration after changing dependencies or
native configuration:

```bash
npm run mobile:sync
```

Open the native projects:

```bash
npm run mobile:ios
npm run mobile:android
```

The default mobile server is
`https://financial-tracker-app-hazel.vercel.app`. To point a local native build
at a different HTTPS deployment:

```bash
CAPACITOR_SERVER_URL=https://example.com npm run mobile:sync
```

Xcode is required to build the iOS project. Android Studio and a compatible JDK
are required to build the Android project.
