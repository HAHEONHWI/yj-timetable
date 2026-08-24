-- rate_limit_per_minute of 0 now means "unlimited" (dev-only keys), instead
-- of blocking every request. Everything else about the function is unchanged.
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

  return p_limit <= 0 or current_count <= p_limit;
end;
$$;
