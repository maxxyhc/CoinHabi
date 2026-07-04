create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  portfolio_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

alter table public.user_settings enable row level security;

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
on public.user_settings
for delete
to authenticated
using (auth.uid() = user_id);
