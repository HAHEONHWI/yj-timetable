create table if not exists public.api_key_requests (
  id uuid primary key,
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (phone ~ '^0[0-9]{8,10}$'),
  otp_hash text check (otp_hash is null or otp_hash ~ '^[a-f0-9]{64}$'),
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0 check (otp_attempts between 0 and 5),
  request_ip_hash text not null check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);

alter table public.api_key_requests enable row level security;
revoke all on public.api_key_requests from anon, authenticated;

create index if not exists api_key_requests_email_created_idx
  on public.api_key_requests (email, created_at desc);
create index if not exists api_key_requests_ip_created_idx
  on public.api_key_requests (request_ip_hash, created_at desc);

alter table public.api_keys
  add column if not exists request_id uuid unique
  references public.api_key_requests(id) on delete set null;

create or replace function public.complete_api_key_email_request(
  p_request_id uuid,
  p_email text,
  p_otp_hash text,
  p_key_prefix text,
  p_key_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pending public.api_key_requests%rowtype;
  issued_key_id uuid;
begin
  select * into pending
  from public.api_key_requests
  where id = p_request_id
  for update;

  if pending.id is null
    or pending.email <> p_email
    or pending.verified_at is not null
    or pending.otp_expires_at <= now()
    or pending.otp_attempts >= 5
    or pending.otp_hash <> p_otp_hash then
    if pending.id is not null and pending.verified_at is null and pending.otp_attempts < 5 then
      update public.api_key_requests
      set otp_attempts = otp_attempts + 1
      where id = p_request_id;
    end if;
    return null;
  end if;

  insert into public.api_keys (
    name,
    key_prefix,
    key_hash,
    rate_limit_per_minute,
    request_id
  ) values (
    pending.name,
    p_key_prefix,
    p_key_hash,
    60,
    pending.id
  ) returning id into issued_key_id;

  update public.api_key_requests
  set verified_at = now(), otp_hash = null, otp_expires_at = null
  where id = pending.id;

  return issued_key_id;
end;
$$;

revoke all on function public.complete_api_key_email_request(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_api_key_email_request(uuid, text, text, text, text)
  to service_role;
