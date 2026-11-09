-- One row per user per day, written by the /api/cron/portfolio-snapshots job.
-- Performance history (returns vs. benchmark, drawdown, attribution) is derived
-- from these rows, so they are append-only from the user's point of view: users
-- can read their own snapshots, only the service role writes them.
create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value_usd numeric(24, 8) not null,
  investment_value_usd numeric(24, 8) not null,
  cash_value_usd numeric(24, 8) not null,
  -- Cost basis of holdings whose cost is known. Day-over-day changes approximate
  -- net contributions, which time-weighted return needs to strip out.
  cost_basis_usd numeric(24, 8) not null,
  -- Holdings valued at a fallback price because no live quote came back.
  -- Rows with unpriced holdings must not be trusted for return calculations.
  unpriced_count integer not null default 0,
  holdings jsonb not null default '[]'::jsonb,
  usd_rates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

alter table public.portfolio_snapshots enable row level security;

revoke all on public.portfolio_snapshots from anon;
revoke all on public.portfolio_snapshots from authenticated;
grant select on public.portfolio_snapshots to authenticated;

drop policy if exists "Users can read own snapshots" on public.portfolio_snapshots;
create policy "Users can read own snapshots"
on public.portfolio_snapshots
for select
to authenticated
using (auth.uid() = user_id);
