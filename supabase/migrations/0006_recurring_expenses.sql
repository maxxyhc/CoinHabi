create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'TWD')),
  category text not null,
  frequency text not null check (frequency in ('monthly', 'yearly')),
  next_due_date date not null,
  payment_method text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_user_due_date_idx
on public.recurring_expenses(user_id, next_due_date);

create index if not exists recurring_expenses_user_active_idx
on public.recurring_expenses(user_id, is_active);

drop trigger if exists set_recurring_expenses_updated_at on public.recurring_expenses;
create trigger set_recurring_expenses_updated_at
before update on public.recurring_expenses
for each row
execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

revoke all on public.recurring_expenses from anon;
grant select, insert, update, delete on public.recurring_expenses to authenticated;

drop policy if exists "Users can read own recurring expenses" on public.recurring_expenses;
create policy "Users can read own recurring expenses"
on public.recurring_expenses
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recurring expenses" on public.recurring_expenses;
create policy "Users can insert own recurring expenses"
on public.recurring_expenses
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own recurring expenses" on public.recurring_expenses;
create policy "Users can update own recurring expenses"
on public.recurring_expenses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recurring expenses" on public.recurring_expenses;
create policy "Users can delete own recurring expenses"
on public.recurring_expenses
for delete
to authenticated
using (auth.uid() = user_id);
