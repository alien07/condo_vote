-- req_0011 B / D027: the System Admin looks after condoVote as a platform,
-- not the building. `system_admin` gives no Manager, Staff, Committee or
-- Auditor rights; the building's data is read only through a temporary,
-- recorded, read-only access the System Admin opens on /system.

-- 1. No building rights from the role ----------------------------------------
-- Roles: the Manager grants building roles, a System Admin grants only
-- system_admin (was: any role, so a System Admin could make anyone Manager).
drop policy if exists "app_roles_select_own_or_admin" on public.app_roles;
drop policy if exists "app_roles_admin_insert" on public.app_roles;
drop policy if exists "app_roles_admin_update" on public.app_roles;
drop policy if exists "app_roles_admin_delete" on public.app_roles;

create policy "app_roles_select_own_or_admin" on public.app_roles
for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.has_app_role('admin')
  or (public.has_app_role('system_admin') and role = 'system_admin')
);

create policy "app_roles_admin_insert" on public.app_roles
for insert to authenticated
with check (
  (public.has_app_role('admin') and role <> 'system_admin')
  or (public.has_app_role('system_admin') and role = 'system_admin')
);

create policy "app_roles_admin_update" on public.app_roles
for update to authenticated
using (
  (public.has_app_role('admin') and role <> 'system_admin')
  or (public.has_app_role('system_admin') and role = 'system_admin')
)
with check (
  (public.has_app_role('admin') and role <> 'system_admin')
  or (public.has_app_role('system_admin') and role = 'system_admin')
);

create policy "app_roles_admin_delete" on public.app_roles
for delete to authenticated
using (
  (public.has_app_role('admin') and role <> 'system_admin')
  or (public.has_app_role('system_admin') and role = 'system_admin')
);

-- PDPA consent records are personal data of the building's people.
drop policy if exists "profile_consents_select_own_or_admin" on public.profile_consents;
create policy "profile_consents_select_own_or_admin" on public.profile_consents
for select to authenticated
using (profile_id = public.current_profile_id() or public.has_app_role('admin'));

-- 2. Temporary read-only access -----------------------------------------------
create table public.system_read_access (
  id uuid primary key default gen_random_uuid(),
  -- Multi-condo later (D009): the building this access is for.
  project_id uuid,
  profile_id uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  end_kind text check (end_kind in ('ended_early', 'expired')),
  created_at timestamptz not null default now(),
  constraint system_read_access_window check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  constraint system_read_access_end check ((ended_at is null) = (end_kind is null))
);

create index system_read_access_open_idx on public.system_read_access (profile_id) where ended_at is null;

-- Written only by the functions below.
alter table public.system_read_access enable row level security;

create policy "system_read_access_select" on public.system_read_access
for select to authenticated
using (
  public.has_app_role('system_admin')
  or public.has_app_role('admin')
  or public.has_app_role('auditor')
);

-- The caller holds system_admin and an open, unexpired access.
create or replace function public.system_read_access_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.system_read_access a
    join public.app_roles r on r.profile_id = a.profile_id and r.role = 'system_admin'
    where a.profile_id = public.current_profile_id()
      and a.ended_at is null
      and now() < a.ends_at
  );
$$;

revoke all on function public.system_read_access_active() from public, anon;
grant execute on function public.system_read_access_active() to authenticated;

-- A published result is for members; system_admin no longer counts as one
-- by role (an approved owner or resident account still does). Sign-in
-- access (profile_access_active) is unchanged: a System Admin still signs in.
create or replace function public.profile_member_access(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.approval_status = 'approved'
      and (
        p.default_status <> 'proxy'
        or exists (select 1 from public.app_roles r where r.profile_id = p.id and r.role <> 'system_admin')
        or exists (
          select 1
          from public.proxy_authorizations pa
          join public.meetings m on m.id = pa.meeting_id
          where pa.proxy_profile_id = p.id
            and pa.status = 'approved'
            and m.status = 'published'
            and m.ends_at > now()
        )
        or exists (
          select 1
          from public.eligible_voters_snapshot e
          join public.meetings m on m.id = e.meeting_id
          where e.profile_id = p.id
            and m.status = 'published'
            and m.ends_at > now()
        )
      )
  );
$$;

revoke all on function public.profile_member_access(uuid) from public, anon, authenticated;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_member_access(public.current_profile_id())
  or exists (
    select 1
    from public.app_roles r
    where r.profile_id = public.current_profile_id()
      and r.role in ('admin', 'committee', 'staff', 'auditor')
  )
  or public.system_read_access_active();
$$;

-- Expiry is written when first noticed (no scheduler): each expired access
-- gets its end and one audit row.
create or replace function public.close_expired_system_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    update public.system_read_access
    set ended_at = ends_at, end_kind = 'expired'
    where ended_at is null and ends_at <= now()
    returning id, profile_id, ends_at
  loop
    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('system_access.expired', v_row.profile_id, 'system_read_access', v_row.id,
      jsonb_build_object('ends_at', v_row.ends_at));
  end loop;
end;
$$;

revoke all on function public.close_expired_system_access() from public, anon, authenticated;

create or replace function public.start_system_read_access(p_reason text, p_hours integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_id uuid;
  v_ends timestamptz;
begin
  if v_profile_id is null or not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Only a system admin opens temporary access.' using errcode = 'P0001';
  end if;

  if p_hours is null or p_hours not in (1, 4, 24) then
    raise exception 'SYSTEM_ACCESS_HOURS: Choose 1, 4 or 24 hours.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'SYSTEM_REASON_REQUIRED: Give a reason.' using errcode = 'P0001';
  end if;

  if char_length(btrim(p_reason)) > 500 then
    raise exception 'SYSTEM_REASON_TOO_LONG: Keep the reason within 500 characters.' using errcode = 'P0001';
  end if;

  perform public.close_expired_system_access();

  if exists (select 1 from public.system_read_access where profile_id = v_profile_id and ended_at is null) then
    raise exception 'SYSTEM_ACCESS_OPEN: Your temporary access is already open.' using errcode = 'P0001';
  end if;

  v_ends := now() + make_interval(hours => p_hours);

  insert into public.system_read_access (profile_id, reason, ends_at)
  values (v_profile_id, btrim(p_reason), v_ends)
  returning id into v_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('system_access.started', v_profile_id, 'system_read_access', v_id,
    jsonb_build_object('reason', btrim(p_reason), 'hours', p_hours, 'ends_at', v_ends));

  return jsonb_build_object('id', v_id, 'ends_at', v_ends);
end;
$$;

create or replace function public.end_system_read_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_row record;
begin
  if v_profile_id is null or not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Only a system admin ends temporary access.' using errcode = 'P0001';
  end if;

  perform public.close_expired_system_access();

  for v_row in
    update public.system_read_access
    set ended_at = now(), end_kind = 'ended_early'
    where profile_id = v_profile_id and ended_at is null
    returning id, ends_at
  loop
    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('system_access.ended', v_profile_id, 'system_read_access', v_row.id,
      jsonb_build_object('planned_end', v_row.ends_at));
  end loop;
end;
$$;

-- Who has temporary access now, for the banners (Manager overview, /audit,
-- the System Admin's own pages). Records expiries first.
create or replace function public.system_access_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_app_role('system_admin') or public.is_office_staff()
          or public.has_app_role('auditor') or public.has_app_role('committee')) then
    raise exception 'SYSTEM_FORBIDDEN: Not allowed.' using errcode = 'P0001';
  end if;

  perform public.close_expired_system_access();

  return jsonb_build_object(
    'mine', public.system_read_access_active(),
    'active', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', coalesce(p.full_name, p.email),
        'reason', a.reason,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'mine', a.profile_id = public.current_profile_id()
      ) order by a.ends_at)
      from public.system_read_access a
      join public.profiles p on p.id = a.profile_id
      where a.ended_at is null and now() < a.ends_at
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.start_system_read_access(text, integer) from public, anon;
revoke all on function public.end_system_read_access() from public, anon;
revoke all on function public.system_access_status() from public, anon;
grant execute on function public.start_system_read_access(text, integer) to authenticated;
grant execute on function public.end_system_read_access() to authenticated;
grant execute on function public.system_access_status() to authenticated;

-- 3. Read-only means: one more permissive SELECT policy per building table.
-- No INSERT, UPDATE or DELETE policy and no write function knows this
-- access, so every write is refused by the database.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_roles', 'audit_logs', 'ballots', 'committee_approvals', 'committee_casting_votes',
    'committee_members', 'condo_profiles', 'documents', 'eligible_voters_snapshot', 'email_logs',
    'manual_ballot_answers', 'manual_ballots', 'meeting_choices', 'meeting_close_approvals',
    'meeting_close_request_answers', 'meeting_close_requests', 'meeting_incidents',
    'meeting_questions', 'meetings', 'owners', 'profile_consents', 'profiles',
    'proxy_authorizations', 'result_correction_requests', 'result_documents',
    'result_objections', 'result_publications', 'result_snapshots', 'room_owners', 'rooms',
    'vote_source_resolutions'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.system_read_access_active())',
      t || '_system_read', t);
  end loop;
end;
$$;

-- Ballot secrecy holds: the same rows the Manager may read (open ballots).
create policy "ballot_answers_system_read" on public.ballot_answers
for select to authenticated
using (
  public.system_read_access_active()
  and exists (
    select 1 from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_answers.ballot_id and meeting.ballot_secrecy = 'open'
  )
);

-- Read functions behind the committee and audit pages also open for it.
-- Only their permission check changes; the bodies stay as defined in 0040
-- and 0046.
create or replace function public.can_read_as_committee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_approve_as_committee() or public.system_read_access_active();
$$;

revoke all on function public.can_read_as_committee() from public, anon;
grant execute on function public.can_read_as_committee() to authenticated;

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.committee_overview()'::regprocedure);
  if position('if not public.can_approve_as_committee() then' in v_def) = 0 then
    raise exception 'committee_overview: permission check not found';
  end if;
  execute replace(v_def, 'if not public.can_approve_as_committee() then', 'if not public.can_read_as_committee() then');

  v_def := pg_get_functiondef('public.result_decisions()'::regprocedure);
  if position('or public.can_approve_as_committee() or' in v_def) = 0 then
    raise exception 'result_decisions: permission check not found';
  end if;
  execute replace(v_def, 'or public.can_approve_as_committee() or', 'or public.can_read_as_committee() or');

  v_def := pg_get_functiondef('public.meeting_comments(uuid)'::regprocedure);
  if position('public.has_app_role(''committee'')) then' in v_def) = 0 then
    raise exception 'meeting_comments: permission check not found';
  end if;
  execute replace(v_def, 'public.has_app_role(''committee'')) then',
    'public.has_app_role(''committee'') or public.system_read_access_active()) then');
end;
$$;

-- 4. System admins manage only system admins (on /system) --------------------
create or replace function public.system_admin_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Not allowed.' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'profile_id', p.id, 'name', p.full_name, 'email', p.email,
      'me', p.id = public.current_profile_id(),
      -- D023 guardrail: the same person also holds building roles.
      'building_roles', coalesce((
        select jsonb_agg(r2.role order by r2.role) from public.app_roles r2
        where r2.profile_id = p.id and r2.role <> 'system_admin'), '[]'::jsonb)
    ) order by p.full_name)
    from public.app_roles r
    join public.profiles p on p.id = r.profile_id
    where r.role = 'system_admin'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.grant_system_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_profile uuid;
  v_building jsonb;
begin
  if not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Only a system admin grants this role.' using errcode = 'P0001';
  end if;

  select id into v_profile from public.profiles
  where lower(btrim(email)) = lower(btrim(coalesce(p_email, ''))) and approval_status = 'approved';

  if v_profile is null then
    raise exception 'SYSTEM_PROFILE_NOT_FOUND: No approved account has this email.' using errcode = 'P0001';
  end if;

  insert into public.app_roles (profile_id, role, granted_by)
  values (v_profile, 'system_admin', v_actor)
  on conflict (profile_id, role) do nothing;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_building
  from public.app_roles where profile_id = v_profile and role <> 'system_admin';

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('role.system_admin_granted', v_actor, 'profile', v_profile,
    jsonb_build_object('granted_role', 'system_admin', 'building_roles', v_building));

  return jsonb_build_object('profile_id', v_profile, 'building_roles', v_building);
end;
$$;

create or replace function public.revoke_system_admin(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_app_role('system_admin') then
    raise exception 'SYSTEM_FORBIDDEN: Only a system admin removes this role.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.app_roles where role = 'system_admin') <= 1 then
    raise exception 'SYSTEM_LAST_ADMIN: Keep at least one system admin.' using errcode = 'P0001';
  end if;

  delete from public.app_roles where profile_id = p_profile_id and role = 'system_admin';

  -- Their temporary access ends with the role.
  update public.system_read_access set ended_at = now(), end_kind = 'ended_early'
  where profile_id = p_profile_id and ended_at is null;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('role.system_admin_removed', public.current_profile_id(), 'profile', p_profile_id,
    jsonb_build_object('removed_role', 'system_admin'));
end;
$$;

revoke all on function public.system_admin_list() from public, anon;
revoke all on function public.grant_system_admin(text) from public, anon;
revoke all on function public.revoke_system_admin(uuid) from public, anon;
grant execute on function public.system_admin_list() to authenticated;
grant execute on function public.grant_system_admin(text) to authenticated;
grant execute on function public.revoke_system_admin(uuid) to authenticated;
