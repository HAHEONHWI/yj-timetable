-- NEIS SBTR_DD_SC_NM("공휴일" / "휴업일" / "해당없음")을 그대로 보관한다.
-- is_school_day 불리언만으로는 공휴일과 학교 재량휴업일을 구분할 수 없어서,
-- 공휴일만 하루 전체 행사로 덮고 달력에 빨간색으로 표시하려면 원본 구분값이 필요하다.
alter table public.academic_events
  add column if not exists holiday_kind text not null default '';

comment on column public.academic_events.holiday_kind is
  'NEIS SBTR_DD_SC_NM 원본값. 공휴일 / 휴업일 / 해당없음 등.';

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
    holiday_kind,
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
    coalesce(row.holiday_kind, ''),
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
    holiday_kind text,
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
