alter table public.training_enrollments
  drop constraint if exists training_enrollments_program_id_fkey;

alter table public.training_enrollments
  add constraint training_enrollments_program_id_fkey
  foreign key (program_id)
  references public.training_programs(id)
  on delete cascade;
