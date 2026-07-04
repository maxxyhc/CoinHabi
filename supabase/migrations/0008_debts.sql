create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  debt_type text not null check (debt_type in ('mortgage', 'car_loan', 'student_loan', 'credit_card', 'personal_loan', 'other')),
  original_principal numeric(14, 2) not null check (original_principal >= 0),
  remaining_principal numeric(14, 2) not null check (remaining_principal >= 0),
  currency text not null check (currency in ('USD', 'TWD')),
  interest_rate numeric(7, 4) not null default 0 check (interest_rate >= 0),
  minimum_payment numeric(14, 2) not null default 0 check (minimum_payment >= 0),
  next_payment_date date not null default current_date,
  lender text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_active_idx
on public.debts(user_id, is_active);

create index if not exists debts_user_next_payment_idx
on public.debts(user_id, next_payment_date);

drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();

alter table public.debts enable row level security;

revoke all on public.debts from anon;
grant select, insert, update, delete on public.debts to authenticated;

drop policy if exists "Users can read own debts" on public.debts;
create policy "Users can read own debts"
on public.debts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own debts" on public.debts;
create policy "Users can insert own debts"
on public.debts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own debts" on public.debts;
create policy "Users can update own debts"
on public.debts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own debts" on public.debts;
create policy "Users can delete own debts"
on public.debts
for delete
to authenticated
using (auth.uid() = user_id);
