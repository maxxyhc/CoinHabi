-- 檔案	                   建立了什麼
-- 0001_initial_schema	  最初的持倉表
-- 0002~0004	            錢包追蹤、EVM 網路、比特幣 xpub
-- 0005.                	收支記帳表
-- 0006                  	固定支出／訂閱表
-- 0007.                 	訂閱管理欄位
-- 0008.                  貸款／債務表
-- 0009.                	每月預算表
-- 0010.                  存你的自訂資產名稱 



create extension if not exists pgcrypto;

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  asset_type text not null check (asset_type in ('crypto', 'us_stock', 'tw_stock', 'cash')),
  symbol text not null,
  name text not null,
  quantity numeric(24, 8) not null check (quantity >= 0),
  average_cost numeric(24, 8) not null check (average_cost >= 0),
  cost_currency text not null check (cost_currency in ('USD', 'TWD')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holdings_user_symbol_unique unique (user_id, symbol)
);

create index if not exists holdings_user_id_idx on public.holdings(user_id);
create index if not exists holdings_asset_type_idx on public.holdings(asset_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_holdings_updated_at on public.holdings;
create trigger set_holdings_updated_at
before update on public.holdings
for each row
execute function public.set_updated_at();

alter table public.holdings enable row level security;

revoke all on public.holdings from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.holdings to authenticated;

drop policy if exists "Users can read own holdings" on public.holdings;
create policy "Users can read own holdings"
on public.holdings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own holdings" on public.holdings;
create policy "Users can insert own holdings"
on public.holdings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own holdings" on public.holdings;
create policy "Users can update own holdings"
on public.holdings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own holdings" on public.holdings;
create policy "Users can delete own holdings"
on public.holdings
for delete
to authenticated
using (auth.uid() = user_id);
