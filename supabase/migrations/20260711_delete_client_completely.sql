create or replace function public.delete_client_completely(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_telegram_id text;
  target_found boolean := false;
begin
  select coalesce(u.telegram_id::text, ''), true
  into target_telegram_id, target_found
  from public.users u
  where u.id = target_user_id
    and coalesce(u.role, 'client') <> 'admin';

  if not coalesce(target_found, false) then
    return;
  end if;

  if to_regclass('public.time_slots') is not null then
    update public.time_slots
    set
      is_booked = false,
      booked_by = null
    where booked_by = target_user_id;
  end if;

  if to_regclass('public.training_lesson_progress') is not null
     and to_regclass('public.training_enrollments') is not null then
    delete from public.training_lesson_progress tlp
    using public.training_enrollments te
    where tlp.enrollment_id = te.id
      and te.user_id = target_user_id;
  end if;

  if to_regclass('public.training_enrollments') is not null then
    delete from public.training_enrollments
    where user_id = target_user_id;
  end if;

  if to_regclass('public.promo_code_redemptions') is not null then
    delete from public.promo_code_redemptions
    where user_id = target_user_id;
  end if;

  if to_regclass('public.pending_referrals') is not null then
    delete from public.pending_referrals
    where target_telegram_id <> ''
      and telegram_id::text = target_telegram_id;
  end if;

  update public.users
  set referred_by = null
  where target_telegram_id <> ''
    and referred_by::text = target_telegram_id;

  delete from public.consultations
  where user_id = target_user_id;

  delete from public.users
  where id = target_user_id
    and coalesce(role, 'client') <> 'admin';
end;
$$;
