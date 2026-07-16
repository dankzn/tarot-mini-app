create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  format_type text not null default 'individual',
  description text not null default '',
  price integer not null default 0,
  duration_label text,
  includes text[] not null default '{}',
  is_group boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid not null references public.training_programs(id) on delete restrict,
  group_id uuid references public.training_groups(id) on delete set null,
  status text not null default 'pending',
  payment_status text not null default 'not_requested',
  final_price integer not null default 0,
  preferred_start text,
  client_comment text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_programs_active_sort
  on public.training_programs (is_active, sort_order);

create index if not exists idx_training_groups_program_status_start
  on public.training_groups (program_id, status, starts_at);

create index if not exists idx_training_enrollments_user_status
  on public.training_enrollments (user_id, status);

create index if not exists idx_training_enrollments_group
  on public.training_enrollments (group_id);

create or replace function public.touch_training_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_training_programs_updated_at on public.training_programs;
create trigger trg_touch_training_programs_updated_at
before update on public.training_programs
for each row execute function public.touch_training_updated_at();

drop trigger if exists trg_touch_training_groups_updated_at on public.training_groups;
create trigger trg_touch_training_groups_updated_at
before update on public.training_groups
for each row execute function public.touch_training_updated_at();

drop trigger if exists trg_touch_training_enrollments_updated_at on public.training_enrollments;
create trigger trg_touch_training_enrollments_updated_at
before update on public.training_enrollments
for each row execute function public.touch_training_updated_at();

insert into public.training_programs (
  slug,
  title,
  format_type,
  description,
  price,
  duration_label,
  includes,
  is_group,
  sort_order
) values
  (
    'individual-basic',
    'Индивидуальное базовое обучение',
    'individual',
    'Личная база Таро с мягким темпом: структура колоды, чтение арканов, первые расклады и уверенная практика.',
    20000,
    '10 занятий',
    array['10 занятий', 'Личная траектория', 'Практика на ваших вопросах', 'Поддержка между встречами'],
    false,
    10
  ),
  (
    'individual-advanced',
    'Индивидуальное расширенное обучение',
    'individual',
    'Глубокий формат для тех, кто хочет читать сложные запросы, видеть связки карт и собирать консультацию как систему.',
    40000,
    '14 занятий',
    array['14 занятий', 'Расширенная практика', 'Этика консультаций', 'Разбор практики'],
    false,
    20
  ),
  (
    'group-basic',
    'Групповое базовое обучение',
    'group',
    'Камерная группа для бережного входа в Таро: база, практика, домашние задания и понятная структура обучения.',
    11500,
    '10 занятий',
    array['10 занятий', 'Камерная группа', 'Домашние задания', 'Общий учебный ритм'],
    true,
    30
  )
on conflict (slug) do update
set
  title = excluded.title,
  format_type = excluded.format_type,
  description = excluded.description,
  price = excluded.price,
  duration_label = excluded.duration_label,
  includes = excluded.includes,
  is_group = excluded.is_group,
  sort_order = excluded.sort_order;
