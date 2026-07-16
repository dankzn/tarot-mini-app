alter table public.promo_codes
  add column if not exists applies_to text not null default 'consultation';

alter table public.promo_codes
  drop constraint if exists promo_codes_applies_to_check;

alter table public.promo_codes
  add constraint promo_codes_applies_to_check
  check (applies_to in ('consultation', 'training', 'all'));

alter table public.training_enrollments
  add column if not exists original_price integer,
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists promo_code text,
  add column if not exists promo_discount integer not null default 0;

alter table public.promo_code_redemptions
  add column if not exists training_enrollment_id uuid references public.training_enrollments(id) on delete set null;

create index if not exists idx_promo_codes_scope_active
  on public.promo_codes (applies_to, is_active);

create index if not exists idx_promo_redemptions_training_enrollment
  on public.promo_code_redemptions (training_enrollment_id);
