-- req_0011 C / D027: written notice at least 7 days before the meeting
-- (Condominium Act s.42/3). A System Admin setting decides whether
-- publishing a meeting with a shorter notice is refused (strict) or only
-- warned about (the Manager confirms; audited). Default: warn.
-- The meeting day is starts_at (meeting-day voting, 0036), not advance
-- voting.

-- Multi-condo later (D009): app_settings gets a project_id with the rest.
alter table public.app_settings
  add column strict_notice_period boolean not null default false;

-- The one place the number of days lives.
create or replace function public.notice_period_days()
returns integer
language sql
immutable
as $$
  select 7;
$$;

revoke all on function public.notice_period_days() from public, anon;
grant execute on function public.notice_period_days() to authenticated;

create or replace function public.strict_notice_period()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select strict_notice_period from public.app_settings order by created_at desc limit 1
  ), false);
$$;

revoke all on function public.strict_notice_period() from public, anon, authenticated;

-- What the publish button needs to know about one meeting.
create or replace function public.meeting_notice_check(p_meeting_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_starts timestamptz;
begin
  if not (public.is_office_staff() or public.system_read_access_active()) then
    raise exception 'MEETING_FORBIDDEN: Not allowed.' using errcode = 'P0001';
  end if;

  select starts_at into v_starts from public.meetings where id = p_meeting_id;

  return jsonb_build_object(
    'days', public.notice_period_days(),
    'strict', public.strict_notice_period(),
    'starts_at', v_starts,
    'short', v_starts is not null and v_starts < now() + make_interval(days => public.notice_period_days()),
    'days_left', case when v_starts is null then null
      else floor(extract(epoch from (v_starts - now())) / 86400)::int end
  );
end;
$$;

revoke all on function public.meeting_notice_check(uuid) from public, anon;
grant execute on function public.meeting_notice_check(uuid) to authenticated;

-- Strict: the database refuses, whichever way the meeting is published.
create or replace function public.enforce_notice_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and public.strict_notice_period()
     and new.starts_at < now() + make_interval(days => public.notice_period_days()) then
    raise exception 'MEETING_NOTICE_TOO_SHORT: The meeting day is less than % days away; notice must be given at least % days before.',
      public.notice_period_days(), public.notice_period_days() using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notice_period() from public, anon, authenticated;

create trigger meetings_enforce_notice_period
before update of status on public.meetings
for each row execute function public.enforce_notice_period();

-- The System Admin's switch on /system, audited.
create or replace function public.set_strict_notice_period(p_strict boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Only a system admin changes this.' using errcode = 'P0001';
  end if;

  select id into v_id from public.app_settings order by created_at desc limit 1;

  if v_id is null then
    insert into public.app_settings (strict_notice_period) values (coalesce(p_strict, false)) returning id into v_id;
  else
    update public.app_settings set strict_notice_period = coalesce(p_strict, false), updated_at = now() where id = v_id;
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('app_settings.strict_notice_changed', public.current_profile_id(), 'app_settings', v_id,
    jsonb_build_object('strict_notice_period', coalesce(p_strict, false), 'days', public.notice_period_days()));
end;
$$;

revoke all on function public.set_strict_notice_period(boolean) from public, anon;
grant execute on function public.set_strict_notice_period(boolean) to authenticated;
