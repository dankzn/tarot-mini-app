create or replace function public.current_loyalty_cycle_start(reference_date date default current_date)
returns date
language sql
stable
as $$
  select case
    when reference_date >= make_date(extract(year from reference_date)::int, 2, 1)
      then make_date(extract(year from reference_date)::int, 2, 1)
    else make_date(extract(year from reference_date)::int - 1, 2, 1)
  end;
$$;

create or replace function public.loyalty_status_by_completed_count(completed_count integer)
returns text
language sql
immutable
as $$
  select case
    when completed_count <= 0 then 'Первое знакомство'
    when completed_count <= 2 then 'Basic'
    when completed_count <= 5 then 'Silver'
    when completed_count <= 10 then 'Gold'
    else 'Platinum'
  end;
$$;

alter table public.users
  add column if not exists loyalty_cycle_started_at date default public.current_loyalty_cycle_start(current_date),
  add column if not exists last_loyalty_review_at date,
  add column if not exists bonus_balance_expires_at date;

update public.users
set loyalty_cycle_started_at = public.current_loyalty_cycle_start(current_date)
where loyalty_cycle_started_at is null;

create index if not exists idx_users_lifecycle_created_at
  on public.users (created_at);

create index if not exists idx_users_loyalty_cycle_started_at
  on public.users (loyalty_cycle_started_at);

create index if not exists idx_users_bonus_balance_expires_at
  on public.users (bonus_balance_expires_at);

create index if not exists idx_consultations_user_status_completed_at
  on public.consultations (user_id, status, completed_at);

create or replace function public.preview_unconverted_clients_for_deletion(grace_days integer default 60)
returns table (
  user_id uuid,
  name text,
  telegram_id text,
  registered_at timestamptz,
  days_since_registration integer
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
    u.created_at as registered_at,
    floor(extract(epoch from (now() - u.created_at)) / 86400)::integer as days_since_registration
  from public.users u
  where coalesce(u.role, 'client') <> 'admin'
    and u.created_at <= now() - make_interval(days => grace_days)
    and not exists (
      select 1
      from public.consultations c
      where c.user_id = u.id
        and c.status = 'completed'
    )
  order by u.created_at asc;
$$;

create or replace function public.delete_unconverted_clients(grace_days integer default 60)
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
  drop table if exists clients_to_delete;

  create temporary table clients_to_delete on commit drop as
    select *
    from public.preview_unconverted_clients_for_deletion(grace_days);

  update public.time_slots ts
  set
    is_booked = false,
    booked_by = null
  where ts.booked_by in (select user_id from clients_to_delete);

  delete from public.promo_code_redemptions pcr
  where pcr.user_id in (select user_id from clients_to_delete);

  delete from public.consultations c
  where c.user_id in (select user_id from clients_to_delete);

  if to_regclass('public.pending_referrals') is not null then
    execute $delete_pending_referrals$
      delete from public.pending_referrals pr
      where pr.telegram_id::text in (select deleted_telegram_id from clients_to_delete)
    $delete_pending_referrals$;
  end if;

  delete from public.users u
  where u.id in (select user_id from clients_to_delete);

  return query
    select
      ctd.user_id,
      ctd.name,
      ctd.telegram_id
    from clients_to_delete ctd;
end;
$$;

create or replace function public.apply_annual_loyalty_review(review_date date default current_date)
returns table (
  user_id uuid,
  old_status text,
  new_status text,
  completed_previous_cycle bigint,
  bonus_reset_at date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle_start date := public.current_loyalty_cycle_start(review_date);
  previous_cycle_start date := (cycle_start - interval '1 year')::date;
  march_first date := make_date(extract(year from cycle_start)::int, 3, 1);
begin
  return query
  with eligible_users as (
    select u.*
    from public.users u
    where coalesce(u.role, 'client') <> 'admin'
      and coalesce(u.loyalty_cycle_started_at, date '1900-01-01') < cycle_start
  ),
  stats as (
    select
      u.id,
      u.status,
      count(c.id) filter (
        where c.status = 'completed'
          and coalesce(c.completed_at, c.scheduled_at, c.created_at) >= greatest(u.created_at, previous_cycle_start::timestamptz)
          and coalesce(c.completed_at, c.scheduled_at, c.created_at) < cycle_start::timestamptz
      ) as completed_count
    from eligible_users u
    left join public.consultations c on c.user_id = u.id
    group by u.id, u.status
  ),
  updated as (
    update public.users u
    set
      status = case
        when s.completed_count = 0 then 'Basic'
        when u.status in ('Первое знакомство', 'Basic', 'Silver', 'Gold', 'Platinum') then u.status
        else public.loyalty_status_by_completed_count((
          select count(*)::integer
          from public.consultations c_all
          where c_all.user_id = u.id
            and c_all.status = 'completed'
        ))
      end,
      bonus_balance_expires_at = case
        when s.completed_count = 0 then march_first
        else null
      end,
      loyalty_cycle_started_at = cycle_start,
      last_loyalty_review_at = review_date
    from stats s
    where u.id = s.id
    returning
      u.id,
      s.status as old_status,
      u.status as new_status,
      s.completed_count,
      u.bonus_balance_expires_at
  )
  select
    updated.id,
    updated.old_status,
    updated.new_status,
    updated.completed_count,
    updated.bonus_balance_expires_at
  from updated;
end;
$$;

create or replace function public.apply_due_bonus_balance_expirations(reference_date date default current_date)
returns table (
  user_id uuid,
  old_bonus_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with expired as (
    select id, bonus_balance
    from public.users
    where bonus_balance_expires_at is not null
      and bonus_balance_expires_at <= reference_date
      and coalesce(bonus_balance, 0) > 0
      and coalesce(role, 'client') <> 'admin'
  ),
  updated as (
    update public.users u
    set
      bonus_balance = 0,
      bonus_balance_expires_at = null
    from expired e
    where u.id = e.id
    returning u.id, e.bonus_balance
  )
  select updated.id, updated.bonus_balance
  from updated;
end;
$$;

grant execute on function public.current_loyalty_cycle_start(date) to anon, authenticated;
grant execute on function public.loyalty_status_by_completed_count(integer) to anon, authenticated;
grant execute on function public.preview_unconverted_clients_for_deletion(integer) to authenticated;
grant execute on function public.delete_unconverted_clients(integer) to authenticated;
grant execute on function public.apply_annual_loyalty_review(date) to authenticated;
grant execute on function public.apply_due_bonus_balance_expirations(date) to authenticated;
