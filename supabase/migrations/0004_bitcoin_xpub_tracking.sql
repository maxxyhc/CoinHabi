alter table public.wallet_accounts
  add column if not exists address_kind text not null default 'address',
  add column if not exists derivation_purpose integer,
  add column if not exists account_index integer not null default 0,
  add column if not exists gap_limit integer not null default 20;

alter table public.wallet_accounts
  drop constraint if exists wallet_accounts_address_kind_check;

alter table public.wallet_accounts
  add constraint wallet_accounts_address_kind_check
  check (address_kind in ('address', 'xpub'));

alter table public.wallet_accounts
  drop constraint if exists wallet_accounts_bitcoin_xpub_check;

alter table public.wallet_accounts
  add constraint wallet_accounts_bitcoin_xpub_check
  check (
    address_kind = 'address'
    or (
      chain = 'bitcoin'
      and derivation_purpose in (44, 49, 84)
      and account_index >= 0
      and gap_limit between 5 and 50
    )
  );
