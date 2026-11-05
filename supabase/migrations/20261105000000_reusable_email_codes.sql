begin;

create table public.provaai_email_codes (
  email_key text primary key,
  code_digest text,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null default '-infinity',
  failures integer not null default 0,
  lease uuid,
  lease_until timestamptz not null default '-infinity',
  retry_at timestamptz not null default '-infinity',
  hour_started timestamptz not null default now(),
  sends integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.provaai_email_codes enable row level security;
revoke all on public.provaai_email_codes from public, anon, authenticated;
grant all on public.provaai_email_codes to service_role;
create index provaai_email_codes_updated on public.provaai_email_codes(updated_at);

-- Todas as decisões de prazo, concorrência e tentativas usam o relógio do banco.
create function public.provaai_code_claim(p_email_key text, p_action text, p_digest text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.provaai_email_codes;
  t timestamptz := clock_timestamp();
  token uuid := gen_random_uuid();
begin
  if p_email_key !~ '^[a-f0-9]{64}$' or p_action not in ('request', 'verify') then
    raise exception 'Invalid request';
  end if;
  delete from public.provaai_email_codes where updated_at < t - interval '1 day';
  insert into public.provaai_email_codes(email_key) values(p_email_key) on conflict do nothing;
  select * into r from public.provaai_email_codes where email_key = p_email_key for update;
  if r.lease_until > t then return jsonb_build_object('status', 'busy'); end if;

  if p_action = 'request' then
    if r.expires_at > t and r.failures < 5 then
      return jsonb_build_object('status', 'reused', 'expiresAt', r.expires_at);
    end if;
    if r.retry_at > t and r.failures < 5 then return jsonb_build_object('status', 'rate_limit'); end if;
    if r.hour_started + interval '1 hour' <= t then
      r.hour_started := t;
      r.sends := 0;
    end if;
    if r.sends >= 6 then return jsonb_build_object('status', 'rate_limit'); end if;
    update public.provaai_email_codes set
      code_digest = null, user_id = null, expires_at = '-infinity', failures = 0,
      lease = token, lease_until = t + interval '90 seconds', retry_at = t + interval '5 seconds',
      hour_started = r.hour_started, sends = r.sends + 1, updated_at = t
    where email_key = p_email_key;
    return jsonb_build_object('status', 'send', 'lease', token);
  end if;

  if r.expires_at <= t then return jsonb_build_object('status', 'expired'); end if;
  if r.failures >= 5 then return jsonb_build_object('status', 'rotate'); end if;
  if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid digest'; end if;
  update public.provaai_email_codes set failures = failures + 1, updated_at = t
    where email_key = p_email_key;
  if r.code_digest is not null and r.code_digest <> p_digest then
    return jsonb_build_object('status', case when r.failures + 1 >= 5 then 'rotate' else 'invalid' end);
  end if;
  update public.provaai_email_codes set lease = token, lease_until = t + interval '90 seconds'
    where email_key = p_email_key;
  return jsonb_build_object('status', case when r.code_digest is null then 'native' else 'reuse' end,
    'lease', token, 'userId', r.user_id, 'expiresAt', r.expires_at);
end $$;

create function public.provaai_code_finish(
  p_email_key text, p_lease uuid, p_result text,
  p_digest text default null, p_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.provaai_email_codes;
  t timestamptz := clock_timestamp();
begin
  select * into r from public.provaai_email_codes where email_key = p_email_key for update;
  if not found or r.lease is distinct from p_lease or r.lease_until <= t then
    return jsonb_build_object('status', 'stale');
  end if;
  if p_result = 'sent' then
    r.expires_at := t + interval '10 minutes';
  elsif p_result = 'verified' then
    if r.expires_at <= t then
      update public.provaai_email_codes set lease = null, lease_until = '-infinity', updated_at = t
        where email_key = p_email_key;
      return jsonb_build_object('status', 'expired');
    end if;
    if p_digest is null or p_user_id is null then raise exception 'Missing proof'; end if;
    r.code_digest := p_digest;
    r.user_id := p_user_id;
    r.failures := 0;
  elsif p_result = 'send_error' then
    r.expires_at := '-infinity';
    r.retry_at := t + interval '5 seconds';
  elsif p_result = 'server_error' then
    r.failures := greatest(0, r.failures - 1);
  elsif p_result <> 'bad_code' then
    raise exception 'Invalid result';
  end if;
  update public.provaai_email_codes set
    expires_at = r.expires_at, code_digest = r.code_digest, user_id = r.user_id,
    failures = r.failures, retry_at = r.retry_at, lease = null, lease_until = '-infinity',
    updated_at = t where email_key = p_email_key;
  return jsonb_build_object('status', case when r.failures >= 5 then 'rotate' else 'ok' end,
    'expiresAt', case when r.expires_at > t then r.expires_at else null end);
end $$;

revoke all on function public.provaai_code_claim(text,text,text) from public, anon, authenticated;
revoke all on function public.provaai_code_finish(text,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.provaai_code_claim(text,text,text) to service_role;
grant execute on function public.provaai_code_finish(text,uuid,text,text,uuid) to service_role;
commit;

