alter table public.training_programs
  add column if not exists has_certificate boolean not null default false;

alter table public.training_enrollments
  add column if not exists certificate_required boolean not null default false,
  add column if not exists exam_status text not null default 'not_required';

alter table public.training_lesson_progress
  add column if not exists attendance_status text not null default 'pending',
  add column if not exists grade integer,
  add column if not exists homework_submitted_text text,
  add column if not exists homework_files jsonb not null default '[]'::jsonb,
  add column if not exists homework_submitted_at timestamptz,
  add column if not exists homework_deadline_extended_until timestamptz,
  add column if not exists homework_unlocked_by_admin boolean not null default false;

create index if not exists idx_training_lesson_progress_attendance
  on public.training_lesson_progress (attendance_status);

create index if not exists idx_training_lesson_progress_homework_status
  on public.training_lesson_progress (homework_status);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-homework',
  'training-homework',
  true,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
