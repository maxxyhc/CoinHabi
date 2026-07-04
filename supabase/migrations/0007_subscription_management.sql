alter table public.recurring_expenses
  add column if not exists is_subscription boolean not null default false,
  add column if not exists usage_status text not null default 'active',
  add column if not exists reminder_days integer not null default 3;

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_usage_status_check;

alter table public.recurring_expenses
  add constraint recurring_expenses_usage_status_check
  check (usage_status in ('active', 'rarely_used', 'consider_canceling'));

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_reminder_days_check;

alter table public.recurring_expenses
  add constraint recurring_expenses_reminder_days_check
  check (reminder_days >= 0 and reminder_days <= 60);

create index if not exists recurring_expenses_user_subscription_idx
on public.recurring_expenses(user_id, is_subscription);
