create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  author_name text not null,
  author_username text,
  rating integer not null default 5 check (rating between 1 and 5),
  text text not null,
  source text not null default 'client' check (source in ('client', 'admin')),
  is_published boolean not null default true,
  reviewed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews_public_read_published" on public.reviews;
drop policy if exists "reviews_public_insert" on public.reviews;
drop policy if exists "reviews_admin_all" on public.reviews;

create policy "reviews_public_read_published"
on public.reviews
for select
to anon, authenticated
using (is_published = true);

create policy "reviews_public_insert"
on public.reviews
for insert
to anon, authenticated
with check (
  length(trim(author_name)) > 0
  and length(trim(text)) > 0
  and rating between 1 and 5
);

create policy "reviews_admin_all"
on public.reviews
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
  )
);

create index if not exists idx_reviews_published_reviewed_at
  on public.reviews (is_published, reviewed_at desc);

create index if not exists idx_reviews_user_id
  on public.reviews (user_id);

grant select, insert on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;
