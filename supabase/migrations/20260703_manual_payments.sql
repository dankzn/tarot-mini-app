alter table public.consultations
  add column if not exists payment_status text default 'unpaid',
  add column if not exists payment_method_id uuid,
  add column if not exists payment_amount integer,
  add column if not exists priority_fee integer default 0,
  add column if not exists payment_marked_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.users(id) on delete set null;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  payment_url text not null,
  instructions text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultations
  drop constraint if exists consultations_payment_method_id_fkey;

alter table public.consultations
  add constraint consultations_payment_method_id_fkey
  foreign key (payment_method_id) references public.payment_methods(id) on delete set null;

create index if not exists idx_consultations_payment_status
  on public.consultations (payment_status);

create index if not exists idx_payment_methods_active_sort
  on public.payment_methods (is_active, sort_order);

create or replace function public.touch_payment_methods_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_payment_methods_updated_at on public.payment_methods;

create trigger trg_touch_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function public.touch_payment_methods_updated_at();

update public.consultations
set payment_status = coalesce(payment_status, 'unpaid'),
    payment_amount = coalesce(payment_amount, price, 0),
    priority_fee = coalesce(priority_fee, 0)
where payment_status is null
   or payment_amount is null
   or priority_fee is null;
