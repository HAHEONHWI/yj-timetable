create table if not exists public.academic_events (
  id text primary key,
  source text not null check (source = 'neis'),
  school_code text not null,
  event_date date not null,
  title text not null,
  content text not null default '',
  grades smallint[] not null default '{}',
  is_school_day boolean not null default true,
  source_updated_at date not null,
  synced_at timestamptz not null default now(),
  constraint academic_events_middle_school_grades
    check (grades <@ array[1, 2, 3]::smallint[])
);

create index if not exists academic_events_date_idx
on public.academic_events (event_date);

alter table public.academic_events enable row level security;

grant select on table public.academic_events to anon, authenticated;
revoke insert, update, delete on table public.academic_events from anon, authenticated;

drop policy if exists "Public can read academic events" on public.academic_events;
create policy "Public can read academic events"
on public.academic_events
for select
to anon, authenticated
using (true);

create or replace function public.replace_neis_academic_events(
  from_date date,
  to_date date,
  event_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if from_date > to_date or to_date - from_date > 370 then
    raise exception 'Invalid academic event replacement range';
  end if;

  if jsonb_typeof(event_rows) <> 'array' then
    raise exception 'Academic event rows must be an array';
  end if;

  delete from public.academic_events
  where source = 'neis'
    and event_date between from_date and to_date;

  insert into public.academic_events (
    id,
    source,
    school_code,
    event_date,
    title,
    content,
    grades,
    is_school_day,
    source_updated_at,
    synced_at
  )
  select
    row.id,
    'neis',
    row.school_code,
    row.event_date,
    row.title,
    coalesce(row.content, ''),
    coalesce(row.grades, '{}'),
    row.is_school_day,
    row.source_updated_at,
    now()
  from jsonb_to_recordset(event_rows) as row(
    id text,
    school_code text,
    event_date date,
    title text,
    content text,
    grades smallint[],
    is_school_day boolean,
    source_updated_at date
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_neis_academic_events(date, date, jsonb)
from public, anon, authenticated;
grant execute on function public.replace_neis_academic_events(date, date, jsonb)
to service_role;
