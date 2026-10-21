alter table public.app_state add column if not exists revision bigint not null default 0;

create table public.student_calls (
  class_name text primary key check (class_name in ('1-1','1-2','2-1','2-2','3-1','3-2')),
  data jsonb not null,
  expires_at timestamptz not null
);
create table public.board_call_tokens (
  class_name text primary key check (class_name in ('1-1','1-2','2-1','2-2','3-1','3-2')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.student_calls enable row level security;
alter table public.board_call_tokens enable row level security;
revoke all on public.student_calls, public.board_call_tokens from public, anon, authenticated;
grant all on public.student_calls, public.board_call_tokens to service_role;

update public.app_state set data =
  '{"base":{},"teachers":{},"teacherMode":"subject","teachersByPeriod":{},"subjectAbbreviations":{},"maskTeacherNames":false,"baseMerges":[],"specialSchedules":{},"changes":{},"events":[],"notices":[]}'::jsonb
  || (data - 'adminPassword' - 'studentCall' - '_revision')
  || jsonb_build_object('studentCall', null, 'slideshow',
    '{"intervalSeconds":8,"refreshSeconds":60,"lessonFontScale":100,"classHeaderFontScale":100,"periodHeaderFontScale":100,"eventFontScale":100,"teacherFontScale":100,"reloadToken":"","scheduleDate":"","scheduleDateExpiresOn":"","showMeal":true,"showTeacher":false}'::jsonb
    || coalesce(data->'slideshow', '{}'::jsonb)), revision = revision + 1
where id = 'main';

-- Historical public snapshots must not retain student-call identities either.
update public.audit_logs set before_data = before_data - 'studentCall', after_data = after_data - 'studentCall'
where before_data ? 'studentCall' or after_data ? 'studentCall';
update public.audit_logs set before_data = before_data - 'password', after_data = after_data - 'password'
where before_data ? 'password' or after_data ? 'password';

create or replace function public.sanitize_public_timetable()
returns trigger language plpgsql set search_path = public as $$
begin
  new.data := new.data - 'adminPassword' - '_revision';
  if new.data->'studentCall' is not null and jsonb_typeof(new.data->'studentCall') = 'object' then
    new.data := jsonb_set(new.data, '{studentCall}', jsonb_build_object(
      'id', new.data#>'{studentCall,id}', 'className', new.data#>'{studentCall,className}',
      'createdAt', new.data#>'{studentCall,createdAt}', 'expiresAt', new.data#>'{studentCall,expiresAt}'));
  else
    new.data := jsonb_set(new.data, '{studentCall}', 'null'::jsonb);
  end if;
  return new;
end;
$$;
create trigger sanitize_public_timetable before insert or update on public.app_state
for each row execute function public.sanitize_public_timetable();

create or replace function public.save_timetable_state(
  p_revision bigint, p_state jsonb, p_call jsonb, p_actor_id uuid, p_actor_role text, p_action text, p_user_agent text
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  current_row public.app_state%rowtype;
  actor public.admin_profiles%rowtype;
  next_state jsonb := p_state;
begin
  select * into strict current_row from public.app_state where id = 'main' for update;
  if current_row.revision <> p_revision then
    raise exception 'Timetable revision conflict' using errcode = '40001';
  end if;
  select * into strict actor from public.admin_profiles where user_id = p_actor_id and is_active = true;
  if actor.role <> p_actor_role then
    raise exception 'Administrator role changed' using errcode = '42501';
  end if;
  if p_call is not null then
    if p_action <> 'call_student' or actor.role not in ('dev','manager','teacher')
      or (p_call->>'expiresAt')::timestamptz <= now()
      or abs(extract(epoch from ((p_call->>'createdAt')::timestamptz - now()))) > 60
      or (p_call->>'expiresAt')::timestamptz - (p_call->>'createdAt')::timestamptz not between interval '1 second' and interval '10 minutes' then
      raise exception 'Invalid student call';
    end if;
    delete from public.student_calls where expires_at <= now();
    insert into public.student_calls(class_name, data, expires_at)
    values (p_call->>'className', p_call, (p_call->>'expiresAt')::timestamptz)
    on conflict(class_name) do update set data = excluded.data, expires_at = excluded.expires_at;
  end if;
  next_state := next_state - 'adminPassword' - '_revision';
  update public.app_state set data = next_state, revision = revision + 1, updated_at = now() where id = 'main';
  insert into public.audit_logs(actor_id, actor_username, actor_name, actor_role, action, target_type, target_id, before_data, after_data, success, user_agent)
  values (actor.user_id, actor.username, coalesce(actor.display_name,actor.username), actor.role, p_action, 'app_state', 'main', current_row.data - 'studentCall', next_state - 'studentCall', true, p_user_agent);
  return current_row.revision + 1;
end;
$$;
revoke all on function public.save_timetable_state(bigint,jsonb,jsonb,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.save_timetable_state(bigint,jsonb,jsonb,uuid,text,text,text) to service_role;
