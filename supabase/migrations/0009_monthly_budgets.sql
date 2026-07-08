create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  month date not null,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'TWD')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budgets_user_month_category_currency_unique unique (user_id, month, category, currency)
);

create index if not exists monthly_budgets_user_month_idx
on public.monthly_budgets(user_id, month);

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
before update on public.monthly_budgets
for each row
execute function public.set_updated_at();

alter table public.monthly_budgets enable row level security;

revoke all on public.monthly_budgets from anon;
grant select, insert, update, delete on public.monthly_budgets to authenticated;

drop policy if exists "Users can read own monthly budgets" on public.monthly_budgets;
create policy "Users can read own monthly budgets"
on public.monthly_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own monthly budgets" on public.monthly_budgets;
create policy "Users can insert own monthly budgets"
on public.monthly_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own monthly budgets" on public.monthly_budgets;
create policy "Users can update own monthly budgets"
on public.monthly_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own monthly budgets" on public.monthly_budgets;
create policy "Users can delete own monthly budgets"
on public.monthly_budgets
for delete
to authenticated
using (auth.uid() = user_id);
