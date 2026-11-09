alter table public.holdings
  add column if not exists break_even_price numeric(24, 8);

alter table public.holdings
  drop constraint if exists holdings_break_even_price_nonnegative;

alter table public.holdings
  add constraint holdings_break_even_price_nonnegative
  check (break_even_price is null or break_even_price >= 0);

comment on column public.holdings.break_even_price is
  'User-entered whole-position break-even price in cost_currency, typically copied from a broker and inclusive of that broker fee/tax convention.';
