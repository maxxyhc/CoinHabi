create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  holding_id uuid references public.holdings(id) on delete set null,
  asset_type text not null check (asset_type in ('crypto', 'us_stock', 'tw_stock')),
  symbol text not null,
  name text not null,
  transaction_type text not null check (transaction_type in ('opening', 'buy', 'sell')),
  quantity numeric(24, 8) not null check (quantity > 0),
  price_per_unit numeric(24, 8) check (price_per_unit is null or price_per_unit >= 0),
  fees numeric(24, 8) not null default 0 check (fees >= 0),
  currency text not null check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW')),
  cost_basis numeric(24, 8) check (cost_basis is null or cost_basis >= 0),
  proceeds numeric(24, 8) check (proceeds is null or proceeds >= 0),
  realized_gain numeric(24, 8),
  transaction_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists investment_transactions_user_date_idx
  on public.investment_transactions(user_id, transaction_date desc, created_at desc);

create index if not exists investment_transactions_holding_idx
  on public.investment_transactions(holding_id);

create unique index if not exists investment_transactions_opening_holding_unique
  on public.investment_transactions(holding_id)
  where transaction_type = 'opening' and holding_id is not null;

alter table public.investment_transactions enable row level security;

revoke all on public.investment_transactions from anon;
grant select, insert on public.investment_transactions to authenticated;

drop policy if exists "Users can read own investment transactions" on public.investment_transactions;
create policy "Users can read own investment transactions"
on public.investment_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own investment transactions" on public.investment_transactions;
create policy "Users can insert own investment transactions"
on public.investment_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

-- Preserve every existing manual position as the user's opening balance. This
-- gives old portfolios a clear starting point without pretending we know trades
-- that happened before Coinhabi started tracking them.
insert into public.investment_transactions (
  user_id,
  holding_id,
  asset_type,
  symbol,
  name,
  transaction_type,
  quantity,
  price_per_unit,
  fees,
  currency,
  cost_basis,
  transaction_date,
  notes,
  created_at
)
select
  h.user_id,
  h.id,
  h.asset_type,
  h.symbol,
  h.name,
  'opening',
  h.quantity,
  case when h.cost_known then h.average_cost else null end,
  0,
  h.cost_currency,
  case
    when h.cost_known then
      h.quantity * case when h.asset_type = 'tw_stock' then 1000 else 1 end * h.average_cost
    else null
  end,
  h.created_at::date,
  'Opening balance when investment history tracking was enabled.',
  h.created_at
from public.holdings h
where h.asset_type <> 'cash'
  and h.source_kind = 'manual'
  and h.quantity > 0
  and not exists (
    select 1
    from public.investment_transactions t
    where t.holding_id = h.id
      and t.transaction_type = 'opening'
  );

create or replace function public.record_manual_holding_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantity_added numeric(24, 8);
  unit_multiplier numeric(24, 8);
  added_cost numeric(24, 8);
  inferred_price numeric(24, 8);
begin
  if new.asset_type = 'cash' or new.source_kind <> 'manual' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    quantity_added := new.quantity;
    added_cost := case
      when new.cost_known then new.quantity * new.average_cost
      else null
    end;
  elsif new.quantity > old.quantity then
    quantity_added := new.quantity - old.quantity;
    added_cost := case
      when new.cost_known and old.cost_known then
        greatest((new.quantity * new.average_cost) - (old.quantity * old.average_cost), 0)
      else null
    end;
  else
    return new;
  end if;

  if quantity_added <= 0 then
    return new;
  end if;

  unit_multiplier := case when new.asset_type = 'tw_stock' then 1000 else 1 end;
  inferred_price := case
    when added_cost is not null then greatest(added_cost / quantity_added, 0)
    else null
  end;

  insert into public.investment_transactions (
    user_id,
    holding_id,
    asset_type,
    symbol,
    name,
    transaction_type,
    quantity,
    price_per_unit,
    fees,
    currency,
    cost_basis,
    transaction_date,
    notes
  ) values (
    new.user_id,
    new.id,
    new.asset_type,
    new.symbol,
    new.name,
    'buy',
    quantity_added,
    case when inferred_price is null then null else inferred_price end,
    0,
    new.cost_currency,
    case when added_cost is null then null else added_cost * unit_multiplier end,
    current_date,
    'Recorded automatically from a manual holding addition.'
  );

  return new;
end;
$$;

drop trigger if exists record_manual_holding_purchase on public.holdings;
create trigger record_manual_holding_purchase
after insert or update of quantity on public.holdings
for each row
execute function public.record_manual_holding_purchase();

create or replace function public.record_investment_sale(
  p_holding_id uuid,
  p_quantity numeric,
  p_price_per_unit numeric,
  p_fees numeric default 0,
  p_transaction_date date default current_date,
  p_notes text default null
)
returns public.investment_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_holding public.holdings%rowtype;
  created_transaction public.investment_transactions%rowtype;
  unit_multiplier numeric(24, 8);
  units_sold numeric(24, 8);
  basis_per_unit numeric(24, 8);
  calculated_cost_basis numeric(24, 8);
  calculated_proceeds numeric(24, 8);
  calculated_gain numeric(24, 8);
  remaining_quantity numeric(24, 8);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Sale quantity must be greater than zero.';
  end if;

  if p_price_per_unit is null or p_price_per_unit <= 0 then
    raise exception 'Sale price must be greater than zero.';
  end if;

  if p_fees is null or p_fees < 0 then
    raise exception 'Fees cannot be negative.';
  end if;

  select *
  into target_holding
  from public.holdings
  where id = p_holding_id
  for update;

  if not found or target_holding.user_id <> auth.uid() then
    raise exception 'Holding not found.';
  end if;

  if target_holding.asset_type = 'cash' or target_holding.source_kind <> 'manual' then
    raise exception 'Only manual investment holdings can record a sale.';
  end if;

  if p_quantity > target_holding.quantity then
    raise exception 'Sale quantity exceeds the current holding.';
  end if;

  unit_multiplier := case when target_holding.asset_type = 'tw_stock' then 1000 else 1 end;
  units_sold := p_quantity * unit_multiplier;
  calculated_proceeds := (units_sold * p_price_per_unit) - p_fees;

  if calculated_proceeds < 0 then
    raise exception 'Fees cannot exceed sale proceeds.';
  end if;

  if target_holding.cost_known then
    basis_per_unit := case
      when target_holding.gain_calculation_mode = 'break_even'
        and target_holding.break_even_price is not null
        and target_holding.break_even_price > 0
      then target_holding.break_even_price
      else target_holding.average_cost
    end;
    calculated_cost_basis := units_sold * basis_per_unit;
    calculated_gain := calculated_proceeds - calculated_cost_basis;
  else
    calculated_cost_basis := null;
    calculated_gain := null;
  end if;

  insert into public.investment_transactions (
    user_id,
    holding_id,
    asset_type,
    symbol,
    name,
    transaction_type,
    quantity,
    price_per_unit,
    fees,
    currency,
    cost_basis,
    proceeds,
    realized_gain,
    transaction_date,
    notes
  ) values (
    target_holding.user_id,
    target_holding.id,
    target_holding.asset_type,
    target_holding.symbol,
    target_holding.name,
    'sell',
    p_quantity,
    p_price_per_unit,
    p_fees,
    target_holding.cost_currency,
    calculated_cost_basis,
    calculated_proceeds,
    calculated_gain,
    coalesce(p_transaction_date, current_date),
    nullif(trim(p_notes), '')
  )
  returning * into created_transaction;

  remaining_quantity := target_holding.quantity - p_quantity;
  if remaining_quantity <= 0 then
    delete from public.holdings where id = target_holding.id;
  else
    update public.holdings
    set quantity = remaining_quantity
    where id = target_holding.id;
  end if;

  return created_transaction;
end;
$$;

revoke all on function public.record_investment_sale(uuid, numeric, numeric, numeric, date, text) from public;
grant execute on function public.record_investment_sale(uuid, numeric, numeric, numeric, date, text) to authenticated;

comment on table public.investment_transactions is
  'Immutable investment ledger for opening balances, manual buys, and realized sales.';

comment on function public.record_investment_sale(uuid, numeric, numeric, numeric, date, text) is
  'Atomically records a sale, calculates realized P/L, and reduces or closes the manual holding.';
