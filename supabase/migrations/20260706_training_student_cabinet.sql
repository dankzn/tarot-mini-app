create table if not exists public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups(id) on delete cascade,
  title text not null,
  description text,
  lesson_at timestamptz,
  homework_title text,
  homework_description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.training_lessons(id) on delete cascade,
  enrollment_id uuid not null references public.training_enrollments(id) on delete cascade,
  attended boolean not null default false,
  homework_status text not null default 'not_started',
  homework_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, enrollment_id)
);

create index if not exists idx_training_lessons_group_sort
  on public.training_lessons (group_id, sort_order, lesson_at);

create index if not exists idx_training_lesson_progress_enrollment
  on public.training_lesson_progress (enrollment_id, lesson_id);

drop trigger if exists trg_touch_training_lessons_updated_at on public.training_lessons;
create trigger trg_touch_training_lessons_updated_at
before update on public.training_lessons
for each row execute function public.touch_training_updated_at();

drop trigger if exists trg_touch_training_lesson_progress_updated_at on public.training_lesson_progress;
create trigger trg_touch_training_lesson_progress_updated_at
before update on public.training_lesson_progress
for each row execute function public.touch_training_updated_at();
