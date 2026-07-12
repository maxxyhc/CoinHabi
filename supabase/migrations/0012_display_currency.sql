alter table public.user_settings
  add column if not exists display_currency text not null default 'USD'
  check (display_currency in ('USD', 'TWD', 'EUR', 'JPY', 'KRW'));
