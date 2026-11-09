-- Add global stock metadata without exposing exchange information in the UI.
alter table public.holdings
  add column if not exists market_code text,
  add column if not exists exchange_code text,
  add column if not exists quote_currency text,
  add column if not exists lot_size numeric(12, 4) not null default 1
    check (lot_size > 0);

update public.holdings
set
  market_code = coalesce(
    market_code,
    case
      when asset_type = 'us_stock' then 'US'
      when asset_type = 'tw_stock' then 'TW'
      else null
    end
  ),
  exchange_code = coalesce(
    exchange_code,
    case
      when asset_type = 'us_stock' then 'US'
      when asset_type = 'tw_stock' and upper(symbol) like '%.TWO' then 'TPEX'
      when asset_type = 'tw_stock' then 'TWSE'
      else null
    end
  ),
  quote_currency = coalesce(quote_currency, cost_currency),
  lot_size = case when asset_type = 'tw_stock' then 1000 else coalesce(lot_size, 1) end;

alter table public.holdings
  drop constraint if exists holdings_asset_type_check,
  add constraint holdings_asset_type_check
    check (asset_type in ('crypto', 'stock', 'us_stock', 'tw_stock', 'cash')),
  drop constraint if exists holdings_cost_currency_check,
  add constraint holdings_cost_currency_check
    check (cost_currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR')),
  drop constraint if exists holdings_quote_currency_check,
  add constraint holdings_quote_currency_check
    check (quote_currency is null or quote_currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

alter table public.investment_transactions
  drop constraint if exists investment_transactions_asset_type_check,
  add constraint investment_transactions_asset_type_check
    check (asset_type in ('crypto', 'stock', 'us_stock', 'tw_stock')),
  drop constraint if exists investment_transactions_currency_check,
  add constraint investment_transactions_currency_check
    check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

alter table public.cashflow_transactions
  drop constraint if exists cashflow_transactions_currency_check,
  add constraint cashflow_transactions_currency_check
    check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_currency_check,
  add constraint recurring_expenses_currency_check
    check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

alter table public.debts
  drop constraint if exists debts_currency_check,
  add constraint debts_currency_check
    check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_currency_check,
  add constraint monthly_budgets_currency_check
    check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW', 'HKD', 'GBP', 'CAD', 'AUD', 'SGD', 'CNY', 'CHF', 'INR', 'SAR'));

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
    added_cost := case when new.cost_known then new.quantity * new.average_cost else null end;
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

  unit_multiplier := coalesce(new.lot_size, case when new.asset_type = 'tw_stock' then 1000 else 1 end);
  inferred_price := case when added_cost is not null then greatest(added_cost / quantity_added, 0) else null end;

  insert into public.investment_transactions (
    user_id, holding_id, asset_type, symbol, name, transaction_type,
    quantity, price_per_unit, fees, currency, cost_basis, transaction_date, notes
  ) values (
    new.user_id, new.id, new.asset_type, new.symbol, new.name, 'buy',
    quantity_added, inferred_price, 0, new.cost_currency,
    case when added_cost is null then null else added_cost * unit_multiplier end,
    current_date, 'Recorded automatically from a manual holding addition.'
  );

  return new;
end;
$$;

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
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Sale quantity must be greater than zero.'; end if;
  if p_price_per_unit is null or p_price_per_unit <= 0 then raise exception 'Sale price must be greater than zero.'; end if;
  if p_fees is null or p_fees < 0 then raise exception 'Fees cannot be negative.'; end if;

  select * into target_holding
  from public.holdings
  where id = p_holding_id
  for update;

  if not found or target_holding.user_id <> auth.uid() then raise exception 'Holding not found.'; end if;
  if target_holding.asset_type = 'cash' or target_holding.source_kind <> 'manual' then
    raise exception 'Only manual investment holdings can record a sale.';
  end if;
  if p_quantity > target_holding.quantity then raise exception 'Sale quantity exceeds the current holding.'; end if;

  unit_multiplier := coalesce(target_holding.lot_size, case when target_holding.asset_type = 'tw_stock' then 1000 else 1 end);
  units_sold := p_quantity * unit_multiplier;
  calculated_proceeds := (units_sold * p_price_per_unit) - p_fees;
  if calculated_proceeds < 0 then raise exception 'Fees cannot exceed sale proceeds.'; end if;

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
    user_id, holding_id, asset_type, symbol, name, transaction_type,
    quantity, price_per_unit, fees, currency, cost_basis, proceeds,
    realized_gain, transaction_date, notes
  ) values (
    target_holding.user_id, target_holding.id, target_holding.asset_type,
    target_holding.symbol, target_holding.name, 'sell', p_quantity,
    p_price_per_unit, p_fees, target_holding.cost_currency,
    calculated_cost_basis, calculated_proceeds, calculated_gain,
    coalesce(p_transaction_date, current_date), nullif(trim(p_notes), '')
  ) returning * into created_transaction;

  remaining_quantity := target_holding.quantity - p_quantity;
  if remaining_quantity <= 0 then
    delete from public.holdings where id = target_holding.id;
  else
    update public.holdings set quantity = remaining_quantity where id = target_holding.id;
  end if;

  return created_transaction;
end;
$$;

comment on column public.holdings.market_code is
  'Internal market identifier inferred from symbol search; intentionally not displayed on saved holding cards.';
comment on column public.holdings.exchange_code is
  'Internal exchange identifier used for quote routing; intentionally not displayed on saved holding cards.';
