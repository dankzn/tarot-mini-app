alter table public.training_lesson_progress enable row level security;

grant select, insert, update on public.training_lesson_progress to anon, authenticated;

drop policy if exists "training_lesson_progress_read" on public.training_lesson_progress;
create policy "training_lesson_progress_read"
on public.training_lesson_progress
for select
to anon, authenticated
using (true);

drop policy if exists "training_lesson_progress_submit_homework" on public.training_lesson_progress;
create policy "training_lesson_progress_submit_homework"
on public.training_lesson_progress
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.training_enrollments enrollment
    join public.training_lessons lesson
      on lesson.id = training_lesson_progress.lesson_id
    where enrollment.id = training_lesson_progress.enrollment_id
      and enrollment.group_id = lesson.group_id
      and enrollment.status in ('enrolled', 'learning', 'completed')
  )
);

drop policy if exists "training_lesson_progress_update_homework" on public.training_lesson_progress;
create policy "training_lesson_progress_update_homework"
on public.training_lesson_progress
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.training_enrollments enrollment
    join public.training_lessons lesson
      on lesson.id = training_lesson_progress.lesson_id
    where enrollment.id = training_lesson_progress.enrollment_id
      and enrollment.group_id = lesson.group_id
      and enrollment.status in ('enrolled', 'learning', 'completed')
  )
)
with check (
  exists (
    select 1
    from public.training_enrollments enrollment
    join public.training_lessons lesson
      on lesson.id = training_lesson_progress.lesson_id
    where enrollment.id = training_lesson_progress.enrollment_id
      and enrollment.group_id = lesson.group_id
      and enrollment.status in ('enrolled', 'learning', 'completed')
  )
);

grant select, insert on storage.objects to anon, authenticated;

drop policy if exists "training_homework_storage_read" on storage.objects;
create policy "training_homework_storage_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'training-homework');

drop policy if exists "training_homework_storage_upload" on storage.objects;
create policy "training_homework_storage_upload"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'training-homework');
