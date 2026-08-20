create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  key_prefix text not null unique check (key_prefix ~ '^[a-f0-9]{8}$'),
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute between 1 and 1000),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  request_count bigint not null default 0 check (request_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;

create table if not exists public.api_rate_limits (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (key_id, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
create index if not exists api_rate_limits_window_start_idx on public.api_rate_limits (window_start);

create or replace function public.consume_api_key_rate_limit(
  p_key_id uuid,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  current_count integer;
begin
  insert into public.api_rate_limits (key_id, window_start, request_count)
  values (p_key_id, current_window, 1)
  on conflict (key_id, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into current_count;

  update public.api_keys
  set last_used_at = now(), request_count = request_count + 1
  where id = p_key_id;

  delete from public.api_rate_limits
  where window_start < now() - interval '1 day';

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_key_rate_limit(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_api_key_rate_limit(uuid, integer) to service_role;
