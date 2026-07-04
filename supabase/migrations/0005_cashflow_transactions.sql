create table if not exists public.cashflow_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'TWD')),
  category text not null,
  description text not null,
  transaction_date date not null default current_date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cashflow_transactions_user_date_idx
on public.cashflow_transactions(user_id, transaction_date desc);

create index if not exists cashflow_transactions_user_type_idx
on public.cashflow_transactions(user_id, transaction_type);

drop trigger if exists set_cashflow_transactions_updated_at on public.cashflow_transactions;
create trigger set_cashflow_transactions_updated_at
before update on public.cashflow_transactions
for each row
execute function public.set_updated_at();

alter table public.cashflow_transactions enable row level security;

revoke all on public.cashflow_transactions from anon;
grant select, insert, update, delete on public.cashflow_transactions to authenticated;

drop policy if exists "Users can read own cashflow transactions" on public.cashflow_transactions;
create policy "Users can read own cashflow transactions"
on public.cashflow_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own cashflow transactions" on public.cashflow_transactions;
create policy "Users can insert own cashflow transactions"
on public.cashflow_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own cashflow transactions" on public.cashflow_transactions;
create policy "Users can update own cashflow transactions"
on public.cashflow_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cashflow transactions" on public.cashflow_transactions;
create policy "Users can delete own cashflow transactions"
on public.cashflow_transactions
for delete
to authenticated
using (auth.uid() = user_id);
