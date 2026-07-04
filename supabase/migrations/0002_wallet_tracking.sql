create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  chain text not null check (chain in ('ethereum', 'bitcoin', 'solana', 'cardano')),
  label text not null,
  address text not null,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'synced', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_accounts_user_chain_address_unique unique (user_id, chain, address)
);

alter table public.holdings
  add column if not exists market_data_id text,
  add column if not exists source_kind text not null default 'manual',
  add column if not exists source_label text,
  add column if not exists source_account_id uuid references public.wallet_accounts(id) on delete cascade,
  add column if not exists source_asset_id text,
  add column if not exists cost_known boolean not null default true;

alter table public.holdings drop constraint if exists holdings_user_symbol_unique;

alter table public.holdings drop constraint if exists holdings_source_kind_check;
alter table public.holdings
  add constraint holdings_source_kind_check check (source_kind in ('manual', 'wallet'));

create unique index if not exists holdings_wallet_asset_unique
  on public.holdings(source_account_id, source_asset_id);

create index if not exists wallet_accounts_user_id_idx on public.wallet_accounts(user_id);
create index if not exists holdings_market_data_id_idx on public.holdings(market_data_id);
create index if not exists holdings_source_account_id_idx on public.holdings(source_account_id);

drop trigger if exists set_wallet_accounts_updated_at on public.wallet_accounts;
create trigger set_wallet_accounts_updated_at
before update on public.wallet_accounts
for each row execute function public.set_updated_at();

alter table public.wallet_accounts enable row level security;

revoke all on public.wallet_accounts from anon;
grant select, insert, update, delete on public.wallet_accounts to authenticated;

drop policy if exists "Users can read own wallet accounts" on public.wallet_accounts;
create policy "Users can read own wallet accounts"
on public.wallet_accounts for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own wallet accounts" on public.wallet_accounts;
create policy "Users can insert own wallet accounts"
on public.wallet_accounts for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own wallet accounts" on public.wallet_accounts;
create policy "Users can update own wallet accounts"
on public.wallet_accounts for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wallet accounts" on public.wallet_accounts;
create policy "Users can delete own wallet accounts"
on public.wallet_accounts for delete to authenticated
using (auth.uid() = user_id);
