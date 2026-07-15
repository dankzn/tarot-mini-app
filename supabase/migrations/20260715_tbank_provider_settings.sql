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
