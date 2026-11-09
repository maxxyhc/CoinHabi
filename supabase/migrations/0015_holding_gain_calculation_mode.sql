alter table public.holdings
  add column if not exists gain_calculation_mode text;

update public.holdings
set gain_calculation_mode = case
  when asset_type = 'cash' then 'average_cost'
  when break_even_price is null then 'estimated'
  when break_even_price = 0 then 'average_cost'
  else 'break_even'
end
where gain_calculation_mode is null
   or gain_calculation_mode not in ('average_cost', 'break_even', 'estimated');

alter table public.holdings
  alter column gain_calculation_mode set default 'estimated',
  alter column gain_calculation_mode set not null;

alter table public.holdings
  drop constraint if exists holdings_gain_calculation_mode_check;

alter table public.holdings
  add constraint holdings_gain_calculation_mode_check
  check (gain_calculation_mode in ('average_cost', 'break_even', 'estimated'));

comment on column public.holdings.gain_calculation_mode is
  'Controls net P/L cost basis: average_cost, broker break_even, or estimated from average cost with a fee warning.';
