create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,32}$'),
  display_name text not null,
  role text not null default 'manager' check (role in ('owner', 'manager', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

grant select on table public.admin_profiles to authenticated;

drop policy if exists "Admins can read own profile" on public.admin_profiles;
create policy "Admins can read own profile"
on public.admin_profiles
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.audit_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_name text,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  success boolean not null default true,
  error_message text,
  user_agent text
);

alter table public.audit_logs enable row level security;

grant select on table public.audit_logs to authenticated;

drop policy if exists "Active admins can read audit logs" on public.audit_logs;
create policy "Active admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = auth.uid()
      and profile.is_active = true
  )
);
