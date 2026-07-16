-- Site credentials storage and RPC setup.
-- Run this migration, then set the RPC secret from Supabase SQL Editor.
-- If you cannot add a new Vercel env var, use the existing TELEGRAM_BOT_TOKEN/BOT_TOKEN value:
--   select public.configure_site_auth_rpc_secret('PASTE_EXISTING_TELEGRAM_BOT_TOKEN_HERE');
--
-- The value must match server getSiteCredentialsSecret():
-- SITE_AUTH_RPC_SECRET -> SITE_AUTH_SECRET -> TELEGRAM_BOT_TOKEN/BOT_TOKEN.
-- Do not commit the real secret.

alter table public.users
  add column if not exists email text,
  add column if not exists site_credentials_completed_at timestamptz;

create unique index if not exists users_email_lower_unique
  on public.users (lower(email))
  where email is not null and email <> '';

create table if not exists public.site_auth_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_auth_credentials enable row level security;

drop policy if exists "site_auth_credentials_no_client_select" on public.site_auth_credentials;
drop policy if exists "site_auth_credentials_no_client_insert" on public.site_auth_credentials;
drop policy if exists "site_auth_credentials_no_client_update" on public.site_auth_credentials;
drop policy if exists "site_auth_credentials_no_client_delete" on public.site_auth_credentials;

create table if not exists public.site_auth_rpc_secrets (
  id boolean primary key default true,
  secret_hash text not null default 'legacy',
  secret_value text,
  updated_at timestamptz not null default now(),
  constraint site_auth_rpc_secrets_single_row check (id is true)
);

alter table public.site_auth_rpc_secrets
  add column if not exists secret_value text;

alter table public.site_auth_rpc_secrets
  alter column secret_hash set default 'legacy';

alter table public.site_auth_rpc_secrets enable row level security;
revoke all on public.site_auth_rpc_secrets from anon, authenticated;

create or replace function public.configure_site_auth_rpc_secret(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_secret, '')) < 24 then
    raise exception 'SITE_AUTH_RPC_SECRET_TOO_SHORT' using errcode = '22023';
  end if;

  insert into public.site_auth_rpc_secrets (id, secret_hash, secret_value, updated_at)
  values (true, 'configured', p_secret, now())
  on conflict (id)
  do update set
    secret_hash = 'configured',
    secret_value = excluded.secret_value,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.configure_site_auth_rpc_secret(text) from public;

create or replace function public.upsert_site_auth_credentials_rpc(
  p_secret text,
  p_user_id uuid,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_secret_value text;
begin
  select secret_value
    into stored_secret_value
    from public.site_auth_rpc_secrets
    where id is true;

  if stored_secret_value is null or coalesce(p_secret, '') <> stored_secret_value then
    raise exception 'SITE_AUTH_RPC_FORBIDDEN' using errcode = '28000';
  end if;

  insert into public.site_auth_credentials (user_id, password_hash, updated_at)
  values (p_user_id, p_password_hash, now())
  on conflict (user_id)
  do update set
    password_hash = excluded.password_hash,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.get_site_auth_credentials_rpc(
  p_secret text,
  p_user_id uuid
)
returns table(password_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_secret_value text;
begin
  select secret_value
    into stored_secret_value
    from public.site_auth_rpc_secrets
    where id is true;

  if stored_secret_value is null or coalesce(p_secret, '') <> stored_secret_value then
    raise exception 'SITE_AUTH_RPC_FORBIDDEN' using errcode = '28000';
  end if;

  return query
    select c.password_hash
    from public.site_auth_credentials c
    where c.user_id = p_user_id
    limit 1;
end;
$$;

create or replace function public.upsert_site_auth_credentials_for_telegram_rpc(
  p_user_id uuid,
  p_telegram_id text,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.telegram_id::text = coalesce(p_telegram_id, '')
  ) then
    raise exception 'SITE_AUTH_TELEGRAM_USER_MISMATCH' using errcode = '28000';
  end if;

  insert into public.site_auth_credentials (user_id, password_hash, updated_at)
  values (p_user_id, p_password_hash, now())
  on conflict (user_id)
  do update set
    password_hash = excluded.password_hash,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.upsert_site_auth_credentials_rpc(text, uuid, text) from public;
revoke all on function public.get_site_auth_credentials_rpc(text, uuid) from public;
revoke all on function public.upsert_site_auth_credentials_for_telegram_rpc(uuid, text, text) from public;

grant execute on function public.upsert_site_auth_credentials_rpc(text, uuid, text) to anon, authenticated;
grant execute on function public.get_site_auth_credentials_rpc(text, uuid) to anon, authenticated;
grant execute on function public.upsert_site_auth_credentials_for_telegram_rpc(uuid, text, text) to anon, authenticated;
