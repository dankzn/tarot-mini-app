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
