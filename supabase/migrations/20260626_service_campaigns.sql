alter table public.services
  add column if not exists next_price integer,
  add column if not exists price_increase_at timestamptz,
  add column if not exists promo_title text,
  add column if not exists promo_price integer,
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz;

create or replace function public.apply_due_service_price_changes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.services
  set
    price = next_price,
    next_price = null,
    price_increase_at = null
  where next_price is not null
    and price_increase_at is not null
    and price_increase_at <= now();
end;
$$;

grant execute on function public.apply_due_service_price_changes() to anon, authenticated;
