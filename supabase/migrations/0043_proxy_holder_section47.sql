-- Who cannot hold a proxy (Condominium Act section 47, 2026-11-19).
--
-- Section 47 bars from holding a proxy: (1) committee members and their
-- spouses, (2) the manager and the manager's spouse, (3) staff of the
-- juristic person or of its contractors, (4) staff of a manager that is a
-- company.
--
-- The database checks what it knows:
-- - committee: an active committee member linked to the profile (term not
--   ended), or the "committee" app role;
-- - office: the "admin" or "staff" app role (the juristic office and the
--   manager in this app).
-- Spouses and contractor staff are not known here; the admin confirms them
-- on the proxy form (checked by the app, written to the audit log).
--
-- Checked when a proxy is added and whenever it becomes pending or approved
-- or changes holder, for every role. Existing rows are not changed.

create or replace function public.proxy_holder_barred(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.committee_members c
      where c.profile_id = p_profile_id
        and c.active
        and (c.term_ends_at is null or c.term_ends_at >= current_date)
    ) or exists (
      select 1 from public.app_roles r
      where r.profile_id = p_profile_id and r.role = 'committee'
    ) then 'committee'
    when exists (
      select 1 from public.app_roles r
      where r.profile_id = p_profile_id and r.role in ('admin', 'staff')
    ) then 'office'
  end;
$$;

revoke execute on function public.proxy_holder_barred(uuid) from public, anon;
grant execute on function public.proxy_holder_barred(uuid) to authenticated;

create or replace function public.guard_proxy_holder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if new.status not in ('pending', 'approved') then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.status = old.status
    and new.proxy_profile_id = old.proxy_profile_id then
    return new;
  end if;

  v_reason := public.proxy_holder_barred(new.proxy_profile_id);

  if v_reason = 'committee' then
    raise exception 'VOTE_PROXY_NOT_ALLOWED: A committee member cannot hold a proxy (Condominium Act section 47).'
      using errcode = 'P0001';
  elsif v_reason = 'office' then
    raise exception 'VOTE_PROXY_NOT_ALLOWED: The manager or juristic office staff cannot hold a proxy (Condominium Act section 47).'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists proxy_authorizations_holder_allowed on public.proxy_authorizations;
create trigger proxy_authorizations_holder_allowed
before insert or update of status, proxy_profile_id
on public.proxy_authorizations
for each row execute function public.guard_proxy_holder();
