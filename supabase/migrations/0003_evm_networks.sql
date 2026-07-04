alter table public.wallet_accounts
  drop constraint if exists wallet_accounts_chain_check;

alter table public.wallet_accounts
  add constraint wallet_accounts_chain_check
  check (chain in (
    'ethereum',
    'base',
    'arbitrum',
    'optimism',
    'polygon',
    'bitcoin',
    'solana',
    'cardano'
  ));
