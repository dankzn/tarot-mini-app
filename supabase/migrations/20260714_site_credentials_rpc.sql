-- Safe server-side bridge for site password hashes
-- Keep RLS enabled on site_auth_credentials. Do not expose password hashes to anon clients.
-- Before running: replace CHANGE_ME_WITH_SITE_AUTH_RPC_SECRET with the same secret that is set in Vercel as SITE_AUTH_RPC_SECRET.

create extension if not exists pgcrypto;

create table if not exists public.site_auth_rpc_secrets (
  id boolean primary key default true,
  secret_hash text not null,
  updated_at timestamptz not null default now(),
  constraint site_auth_rpc_secrets_single_row check (id is true)
);

alter table public.site_auth_rpc_secrets enable row level security;
revoke all on public.site_auth_rpc_secrets from anon, authenticated;

insert into public.site_auth_rpc_secrets (id, secret_hash, updated_at)
values (true, crypt('CHANGE_ME_WITH_SITE_AUTH_RPC_SECRET', gen_salt('bf')), now())
on conflict (id) do update
set secret_hash = excluded.secret_hash,
    updated_at = now();

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
  stored_secret_hash text;
begin
  select secret_hash
    into stored_secret_hash
    from public.site_auth_rpc_secrets
    where id is true;

  if stored_secret_hash is null or crypt(coalesce(p_secret, ''), stored_secret_hash) <> stored_secret_hash then
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
  stored_secret_hash text;
begin
  select secret_hash
    into stored_secret_hash
    from public.site_auth_rpc_secrets
    where id is true;

  if stored_secret_hash is null or crypt(coalesce(p_secret, ''), stored_secret_hash) <> stored_secret_hash then
    raise exception 'SITE_AUTH_RPC_FORBIDDEN' using errcode = '28000';
  end if;

  return query
    select c.password_hash
    from public.site_auth_credentials c
    where c.user_id = p_user_id
    limit 1;
end;
$$;

revoke all on function public.upsert_site_auth_credentials_rpc(text, uuid, text) from public;
revoke all on function public.get_site_auth_credentials_rpc(text, uuid) from public;

grant execute on function public.upsert_site_auth_credentials_rpc(text, uuid, text) to anon, authenticated;
grant execute on function public.get_site_auth_credentials_rpc(text, uuid) to anon, authenticated;
