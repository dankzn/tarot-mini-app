alter table public.users
  add column if not exists inactivity_notice_accepted_at timestamptz,
  add column if not exists last_activity_at timestamptz default now();

update public.users
set last_activity_at = coalesce(last_activity_at, created_at, now())
where last_activity_at is null;

-- Existing users should not get a new post-registration modal.
update public.users
set inactivity_notice_accepted_at = coalesce(inactivity_notice_accepted_at, now())
where inactivity_notice_accepted_at is null
  and created_at < now() - interval '5 minutes';

create index if not exists idx_users_last_activity_at
  on public.users (last_activity_at);

create index if not exists idx_users_inactivity_notice_accepted_at
  on public.users (inactivity_notice_accepted_at);

create or replace function public.preview_inactive_clients_for_deletion(grace_days integer default 365)
returns table (
  user_id uuid,
  name text,
  telegram_id text,
  last_activity_at timestamptz,
  days_since_activity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.name,
    u.telegram_id::text,
    coalesce(u.last_activity_at, u.created_at) as last_activity_at,
    floor(extract(epoch from (now() - coalesce(u.last_activity_at, u.created_at))) / 86400)::integer as days_since_activity
  from public.users u
  where coalesce(u.role, 'client') <> 'admin'
    and coalesce(u.last_activity_at, u.created_at) <= now() - make_interval(days => grace_days)
  order by coalesce(u.last_activity_at, u.created_at) asc;
$$;

create or replace function public.delete_inactive_clients(grace_days integer default 365)
returns table (
  deleted_user_id uuid,
  deleted_name text,
  deleted_telegram_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  drop table if exists inactive_clients_to_delete;

  create temporary table inactive_clients_to_delete on commit drop as
    select *
    from public.preview_inactive_clients_for_deletion(grace_days);

  update public.time_slots ts
  set
    is_booked = false,
    booked_by = null
  where ts.booked_by in (select user_id from inactive_clients_to_delete);

  delete from public.promo_code_redemptions pcr
  where pcr.user_id in (select user_id from inactive_clients_to_delete);

  delete from public.consultations c
  where c.user_id in (select user_id from inactive_clients_to_delete);

  if to_regclass('public.training_enrollments') is not null then
    delete from public.training_enrollments te
    where te.user_id in (select user_id from inactive_clients_to_delete);
  end if;

  if to_regclass('public.site_auth_credentials') is not null then
    delete from public.site_auth_credentials sac
    where sac.user_id in (select user_id from inactive_clients_to_delete);
  end if;

  if to_regclass('public.pending_referrals') is not null then
    execute $delete_pending_referrals$
      delete from public.pending_referrals pr
      where pr.telegram_id::text in (select deleted_telegram_id from inactive_clients_to_delete)
    $delete_pending_referrals$;
  end if;

  delete from public.users u
  where u.id in (select user_id from inactive_clients_to_delete);

  return query
    select
      ctd.user_id,
      ctd.name,
      ctd.telegram_id
    from inactive_clients_to_delete ctd;
end;
$$;

grant execute on function public.preview_inactive_clients_for_deletion(integer) to authenticated;
grant execute on function public.delete_inactive_clients(integer) to authenticated;
