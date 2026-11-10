alter table public.provaai_email_codes add column last_delivered_at timestamptz;
create function public.provaai_mark_code_delivery() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.last_delivered_at := clock_timestamp();
  return new;
end $$;
create trigger provaai_mark_code_delivery before update of expires_at on public.provaai_email_codes
for each row when (new.expires_at <> old.expires_at and isfinite(new.expires_at))
execute function public.provaai_mark_code_delivery();
revoke all on function public.provaai_mark_code_delivery() from public, anon, authenticated;

-- O Auth usa recovery_sent_at para magic links e confirmation_sent_at para cadastro.
-- Libera somente o relógio de envio do destinatário com uma reserva ativa.
create or replace function public.provaai_release_email_interval(
  p_email_key text, p_lease uuid, p_email text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  t timestamptz := clock_timestamp();
begin
  perform 1 from public.provaai_email_codes
    where email_key = p_email_key and lease = p_lease and lease_until > t
      and expires_at = '-infinity' and code_digest is null and failures = 0
      and last_delivered_at > t - interval '20 minutes'
    for update;
  if not found then return false; end if;
  update auth.users set
    recovery_sent_at = case when email_confirmed_at is not null then
      least(recovery_sent_at, t - interval '1 day') else recovery_sent_at end,
    confirmation_sent_at = case when email_confirmed_at is null then
      least(confirmation_sent_at, t - interval '1 day') else confirmation_sent_at end
    where lower(email) = p_email and is_sso_user = false and deleted_at is null
      and (case when email_confirmed_at is null then confirmation_sent_at else recovery_sent_at end) > t - interval '10 minutes';
  return found;
end $$;

revoke all on function public.provaai_release_email_interval(text,uuid,text) from public, anon, authenticated;
grant execute on function public.provaai_release_email_interval(text,uuid,text) to service_role;
