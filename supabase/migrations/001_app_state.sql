create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Public can read app state" on public.app_state;
create policy "Public can read app state"
on public.app_state
for select
to anon, authenticated
using (id = 'main');

insert into public.app_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
