create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  provider text not null default 'tbank',
  order_id text not null unique,
  payment_id text,
  status text not null default 'created',
  amount integer not null default 0,
  description text,
  payment_url text,
  cart_items jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  raw_notification jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_attempts_user_created
  on public.payment_attempts (user_id, created_at desc);

create index if not exists idx_payment_attempts_order_id
  on public.payment_attempts (order_id);

create index if not exists idx_payment_attempts_payment_id
  on public.payment_attempts (payment_id);

create index if not exists idx_payment_attempts_status
  on public.payment_attempts (status);

create or replace function public.touch_payment_attempts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_payment_attempts_updated_at on public.payment_attempts;

create trigger trg_touch_payment_attempts_updated_at
before update on public.payment_attempts
for each row
execute function public.touch_payment_attempts_updated_at();
