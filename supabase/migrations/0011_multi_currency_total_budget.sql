alter table public.holdings
  drop constraint if exists holdings_cost_currency_check,
  add constraint holdings_cost_currency_check
  check (cost_currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));

alter table public.cashflow_transactions
  drop constraint if exists cashflow_transactions_currency_check,
  add constraint cashflow_transactions_currency_check
  check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_currency_check,
  add constraint recurring_expenses_currency_check
  check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));

alter table public.debts
  drop constraint if exists debts_currency_check,
  add constraint debts_currency_check
  check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_currency_check,
  add constraint monthly_budgets_currency_check
  check (currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));
