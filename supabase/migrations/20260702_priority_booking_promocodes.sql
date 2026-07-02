alter table public.consultations
  add column if not exists scheduling_status text default 'scheduled',
  add column if not exists requested_date date,
  add column if not exists requested_time_text text,
  add column if not exists client_time_counterproposal text,
  add column if not exists proposed_at timestamptz,
  add column if not exists promo_code_id uuid,
  add column if not exists promo_code text,
  add column if not exists promo_discount integer default 0;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text,
  discount_type text not null default 'fixed',
  discount_value integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

create index if not exists idx_consultations_scheduling_status
  on public.consultations (scheduling_status);

create index if not exists idx_promo_codes_code
  on public.promo_codes (upper(code));
