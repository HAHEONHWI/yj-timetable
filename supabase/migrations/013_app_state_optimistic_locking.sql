alter table public.app_state
  add column if not exists version integer not null default 1;

update public.app_state
set version = 1
where version < 1;
