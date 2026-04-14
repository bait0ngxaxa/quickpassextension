-- Step 1: สร้างตารางสำหรับเก็บข้อมูลที่เข้ารหัส + เปิด RLS

create extension if not exists pgcrypto;

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('login', 'secret')),
  domain text not null,
  label text not null default '',
  cipher_json jsonb not null,
  pinned boolean not null default false,
  last_used_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vault_items_user_id on public.vault_items(user_id);
create index if not exists idx_vault_items_updated_at on public.vault_items(updated_at desc);

alter table public.vault_items enable row level security;

drop policy if exists "vault_select_own" on public.vault_items;
create policy "vault_select_own"
on public.vault_items
for select
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_insert_own" on public.vault_items;
create policy "vault_insert_own"
on public.vault_items
for insert
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_update_own" on public.vault_items;
create policy "vault_update_own"
on public.vault_items
for update
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "vault_delete_own" on public.vault_items;
create policy "vault_delete_own"
on public.vault_items
for delete
using (auth.uid() is not null and auth.uid() = user_id);
