alter table public.services
  add column if not exists category_id text,
  add column if not exists display_badge text,
  add column if not exists request_tags text[] default '{}',
  add column if not exists short_description text,
  add column if not exists sort_order integer default 0;

alter table public.users
  add column if not exists admin_private_notes text;
