create extension if not exists pgcrypto;

create table if not exists public.payment_provider_settings (
  provider text primary key,
  is_active boolean not null default true,
  terminal_key text,
  terminal_password text,
  api_url text not null default 'https://rest-api-test.tinkoff.ru/v2/Init',
  success_url text,
  fail_url text,
  notification_url text,
  updated_at timestamptz not null default now()
);

alter table public.payment_provider_settings enable row level security;
revoke all on public.payment_provider_settings from anon, authenticated;

insert into public.payment_provider_settings (provider, is_active, api_url)
values ('tbank', false, 'https://rest-api-test.tinkoff.ru/v2/Init')
on conflict (provider) do nothing;

create or replace function public.verify_site_rpc_secret(p_secret text)
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

  return stored_secret_hash is not null
    and crypt(coalesce(p_secret, ''), stored_secret_hash) = stored_secret_hash;
end;
$$;

create or replace function public.get_tbank_provider_settings_rpc(p_secret text)
returns table(
  is_active boolean,
  terminal_key text,
  terminal_password text,
  api_url text,
  success_url text,
  fail_url text,
  notification_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_site_rpc_secret(p_secret) then
    raise exception 'SITE_AUTH_RPC_FORBIDDEN' using errcode = '28000';
  end if;

  return query
    select
      s.is_active,
      s.terminal_key,
      s.terminal_password,
      s.api_url,
      s.success_url,
      s.fail_url,
      s.notification_url,
      s.updated_at
    from public.payment_provider_settings s
    where s.provider = 'tbank'
    limit 1;
end;
$$;

create or replace function public.upsert_tbank_provider_settings_rpc(
  p_secret text,
  p_is_active boolean,
  p_terminal_key text,
  p_terminal_password text,
  p_api_url text,
  p_success_url text default null,
  p_fail_url text default null,
  p_notification_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_password text;
begin
  if not public.verify_site_rpc_secret(p_secret) then
    raise exception 'SITE_AUTH_RPC_FORBIDDEN' using errcode = '28000';
  end if;

  select terminal_password
    into existing_password
    from public.payment_provider_settings
    where provider = 'tbank';

  insert into public.payment_provider_settings (
    provider,
    is_active,
    terminal_key,
    terminal_password,
    api_url,
    success_url,
    fail_url,
    notification_url,
    updated_at
  )
  values (
    'tbank',
    coalesce(p_is_active, false),
    nullif(trim(coalesce(p_terminal_key, '')), ''),
    coalesce(nullif(p_terminal_password, ''), existing_password),
    coalesce(nullif(trim(coalesce(p_api_url, '')), ''), 'https://rest-api-test.tinkoff.ru/v2/Init'),
    nullif(trim(coalesce(p_success_url, '')), ''),
    nullif(trim(coalesce(p_fail_url, '')), ''),
    nullif(trim(coalesce(p_notification_url, '')), ''),
    now()
  )
  on conflict (provider) do update set
    is_active = excluded.is_active,
    terminal_key = excluded.terminal_key,
    terminal_password = coalesce(excluded.terminal_password, public.payment_provider_settings.terminal_password),
    api_url = excluded.api_url,
    success_url = excluded.success_url,
    fail_url = excluded.fail_url,
    notification_url = excluded.notification_url,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.verify_site_rpc_secret(text) from public;
revoke all on function public.get_tbank_provider_settings_rpc(text) from public;
revoke all on function public.upsert_tbank_provider_settings_rpc(text, boolean, text, text, text, text, text, text) from public;

grant execute on function public.get_tbank_provider_settings_rpc(text) to anon, authenticated;
grant execute on function public.upsert_tbank_provider_settings_rpc(text, boolean, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.is_site_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
  );
$$;

create or replace function public.get_tbank_provider_settings_admin_rpc()
returns table(
  is_active boolean,
  terminal_key text,
  has_password boolean,
  api_url text,
  success_url text,
  fail_url text,
  notification_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin_user() then
    raise exception 'ADMIN_REQUIRED' using errcode = '28000';
  end if;

  return query
    select
      s.is_active,
      s.terminal_key,
      coalesce(s.terminal_password, '') <> '' as has_password,
      s.api_url,
      s.success_url,
      s.fail_url,
      s.notification_url,
      s.updated_at
    from public.payment_provider_settings s
    where s.provider = 'tbank'
    limit 1;
end;
$$;

create or replace function public.upsert_tbank_provider_settings_admin_rpc(
  p_is_active boolean,
  p_terminal_key text,
  p_terminal_password text,
  p_api_url text,
  p_success_url text default null,
  p_fail_url text default null,
  p_notification_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_password text;
begin
  if not public.is_site_admin_user() then
    raise exception 'ADMIN_REQUIRED' using errcode = '28000';
  end if;

  select terminal_password
    into existing_password
    from public.payment_provider_settings
    where provider = 'tbank';

  insert into public.payment_provider_settings (
    provider,
    is_active,
    terminal_key,
    terminal_password,
    api_url,
    success_url,
    fail_url,
    notification_url,
    updated_at
  )
  values (
    'tbank',
    coalesce(p_is_active, false),
    nullif(trim(coalesce(p_terminal_key, '')), ''),
    coalesce(nullif(p_terminal_password, ''), existing_password),
    coalesce(nullif(trim(coalesce(p_api_url, '')), ''), 'https://rest-api-test.tinkoff.ru/v2/Init'),
    nullif(trim(coalesce(p_success_url, '')), ''),
    nullif(trim(coalesce(p_fail_url, '')), ''),
    nullif(trim(coalesce(p_notification_url, '')), ''),
    now()
  )
  on conflict (provider) do update set
    is_active = excluded.is_active,
    terminal_key = excluded.terminal_key,
    terminal_password = coalesce(excluded.terminal_password, public.payment_provider_settings.terminal_password),
    api_url = excluded.api_url,
    success_url = excluded.success_url,
    fail_url = excluded.fail_url,
    notification_url = excluded.notification_url,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.get_tbank_runtime_settings_rpc()
returns table(
  is_active boolean,
  terminal_key text,
  has_password boolean,
  api_url text,
  success_url text,
  fail_url text,
  notification_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      s.is_active,
      s.terminal_key,
      coalesce(s.terminal_password, '') <> '' as has_password,
      s.api_url,
      s.success_url,
      s.fail_url,
      s.notification_url
    from public.payment_provider_settings s
    where s.provider = 'tbank'
      and s.is_active is true
    limit 1;
end;
$$;

create or replace function public.sign_tbank_payload_rpc(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_terminal_key text;
  provider_password text;
  payload_terminal_key text;
  signing_string text;
begin
  select terminal_key, terminal_password
    into provider_terminal_key, provider_password
    from public.payment_provider_settings
    where provider = 'tbank'
      and is_active is true
    limit 1;

  if coalesce(provider_terminal_key, '') = '' or coalesce(provider_password, '') = '' then
    raise exception 'TBANK_NOT_CONFIGURED' using errcode = '28000';
  end if;

  payload_terminal_key := coalesce(p_payload ->> 'TerminalKey', '');
  if payload_terminal_key <> provider_terminal_key then
    raise exception 'TBANK_TERMINAL_KEY_MISMATCH' using errcode = '28000';
  end if;

  if coalesce(p_payload ->> 'OrderId', '') not like 'TB-%' then
    raise exception 'TBANK_ORDER_ID_INVALID' using errcode = '22023';
  end if;

  select string_agg(value #>> '{}', '' order by key)
    into signing_string
    from jsonb_each(p_payload || jsonb_build_object('Password', provider_password))
    where key <> 'Token'
      and jsonb_typeof(value) not in ('object', 'array', 'null');

  return encode(digest(coalesce(signing_string, ''), 'sha256'), 'hex');
end;
$$;

create or replace function public.verify_tbank_payload_token_rpc(p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_token text;
  calculated_token text;
begin
  incoming_token := coalesce(p_payload ->> 'Token', '');
  if incoming_token = '' then
    return false;
  end if;

  calculated_token := public.sign_tbank_payload_rpc(p_payload - 'Token');
  return incoming_token = calculated_token;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_site_admin_user() from public;
revoke all on function public.get_tbank_provider_settings_admin_rpc() from public;
revoke all on function public.upsert_tbank_provider_settings_admin_rpc(boolean, text, text, text, text, text, text) from public;
revoke all on function public.get_tbank_runtime_settings_rpc() from public;
revoke all on function public.sign_tbank_payload_rpc(jsonb) from public;
revoke all on function public.verify_tbank_payload_token_rpc(jsonb) from public;

grant execute on function public.get_tbank_provider_settings_admin_rpc() to authenticated;
grant execute on function public.upsert_tbank_provider_settings_admin_rpc(boolean, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_tbank_runtime_settings_rpc() to anon, authenticated;
grant execute on function public.sign_tbank_payload_rpc(jsonb) to anon, authenticated;
grant execute on function public.verify_tbank_payload_token_rpc(jsonb) to anon, authenticated;
