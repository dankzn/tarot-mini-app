create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  message text not null,
  parse_mode text not null default 'HTML',
  status text not null default 'pending',
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_queue_status_created_idx
on public.notification_queue (status, created_at);

alter table public.notification_queue enable row level security;

drop policy if exists "Anyone can enqueue notifications" on public.notification_queue;
create policy "Anyone can enqueue notifications"
on public.notification_queue
for insert
to anon, authenticated
with check (status = 'pending');
