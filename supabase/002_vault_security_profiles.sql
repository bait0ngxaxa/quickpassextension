create table if not exists public.vault_security_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strategy text not null,
  iterations integer not null,
  verifier jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vault_security_profiles_updated_at
on public.vault_security_profiles(updated_at desc);

alter table public.vault_security_profiles enable row level security;

drop policy if exists "vault_security_select_own" on public.vault_security_profiles;
create policy "vault_security_select_own"
on public.vault_security_profiles
for select
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_security_insert_own" on public.vault_security_profiles;
create policy "vault_security_insert_own"
on public.vault_security_profiles
for insert
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_security_update_own" on public.vault_security_profiles;
create policy "vault_security_update_own"
on public.vault_security_profiles
for update
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_security_delete_own" on public.vault_security_profiles;
create policy "vault_security_delete_own"
on public.vault_security_profiles
for delete
using (auth.uid() is not null and auth.uid() = user_id);
