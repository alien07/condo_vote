-- Roles and room ownership (demo feedback items 14a-d and 15).
--
-- 14a Separation of duties: whoever generated a result, or answered a
--     correction of that meeting as fixed, cannot approve it. (A requester
--     cannot answer their own correction request: 0030.)
-- 14b Auditor: a read-only role for results, official records, committee
--     requests and the audit log.
-- 14c Office staff: data entry only (rooms, owners, ownership, Excel import,
--     paper ballots). Admin ("manager") keeps everything that affects a
--     resolution: publishing meetings, results, corrections, roles.
-- 14d A proxy holder who is neither owner nor resident keeps access only
--     while holding a proxy for a meeting that is still open.
-- 15  One owner of record per room: co_owner links end; a co-owner is a
--     resident whom the owner lets vote for one meeting, in the app.

-- Roles -----------------------------------------------------------------------------

alter table public.app_roles drop constraint app_roles_role_check;
alter table public.app_roles
  add constraint app_roles_role_check
  check (role in ('admin', 'committee', 'system_admin', 'staff', 'auditor'));

create or replace function public.is_office_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role('admin') or public.has_app_role('staff');
$$;

revoke execute on function public.is_office_staff() from public;
grant execute on function public.is_office_staff() to authenticated;

-- Staff write the data-entry tables and read what those forms need. Every
-- policy that said "admin" on these tables now says "admin or staff".
do $policies$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        tablename in ('rooms', 'owners', 'room_owners', 'manual_ballots', 'manual_ballot_answers')
        or (cmd = 'SELECT' and tablename in (
          'meetings', 'meeting_questions', 'meeting_choices', 'eligible_voters_snapshot',
          'profiles', 'documents', 'proxy_authorizations'))
      )
      and (coalesce(qual, '') like '%has_app_role(''admin''::text)%'
        or coalesce(with_check, '') like '%has_app_role(''admin''::text)%')
  loop
    v_using := replace(r.qual, 'has_app_role(''admin''::text)', 'is_office_staff()');
    v_check := replace(r.with_check, 'has_app_role(''admin''::text)', 'is_office_staff()');
    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);

    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;

    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
  end loop;
end;
$policies$;

-- Paper ballots by office staff too.
-- Admin import of a paper or offline ballot (D010).
create or replace function public.submit_manual_ballot(
  p_meeting_id uuid,
  p_room_id uuid,
  p_voter_profile_id uuid,
  p_voter_identity_text text,
  p_audit_note text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_importer_id uuid := public.current_profile_id();
  v_pending boolean := p_voter_profile_id is null;
  v_ballot_id uuid;
  v_identity text := nullif(btrim(coalesce(p_voter_identity_text, '')), '');
begin
  if not public.is_office_staff() then
    raise exception 'VOTE_FORBIDDEN: Only office staff or admins can import manual ballots.' using errcode = 'P0001';
  end if;

  if v_pending and v_identity is null then
    raise exception 'VOTE_INVALID_ANSWERS: Voter profile or pending voter identity is required.' using errcode = 'P0001';
  end if;

  insert into public.manual_ballots (
    meeting_id, room_id, imported_by, voter_profile_id, voter_identity_text,
    identity_status, source_label, status, audit_note
  )
  values (
    p_meeting_id, p_room_id, v_importer_id, p_voter_profile_id,
    case when v_pending then v_identity else null end,
    case when v_pending then 'pending' else 'linked' end,
    case when v_pending then 'manual_pending_identity' else 'manual_on_site' end,
    case when v_pending then 'draft' else 'submitted' end,
    nullif(btrim(coalesce(p_audit_note, '')), '')
  )
  on conflict (meeting_id, room_id) do update set
    imported_by = excluded.imported_by,
    voter_profile_id = excluded.voter_profile_id,
    voter_identity_text = excluded.voter_identity_text,
    identity_status = excluded.identity_status,
    source_label = excluded.source_label,
    status = excluded.status,
    audit_note = excluded.audit_note
  returning id into v_ballot_id;

  delete from public.manual_ballot_answers where manual_ballot_id = v_ballot_id;
  insert into public.manual_ballot_answers (manual_ballot_id, question_id, choice_id)
  select v_ballot_id, a.question_id, a.choice_id
  from public.vote_normalize_answers(p_meeting_id, p_answers) as a;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values (
    case when v_pending then 'manual_ballot.pending_identity_saved' else 'manual_ballot.submitted' end,
    v_importer_id,
    'manual_ballot',
    v_ballot_id,
    jsonb_strip_nulls(jsonb_build_object(
      'meeting_id', p_meeting_id,
      'room_id', p_room_id,
      'pending_identity', v_pending,
      'voter_identity_text', case when v_pending then v_identity end,
      'voter_profile_id', p_voter_profile_id
    ))
  );

  return jsonb_build_object('manual_ballot_id', v_ballot_id, 'pending_identity', v_pending);
end;
$$;

-- Auditor: read only ----------------------------------------------------------------

create policy "audit_logs_auditor_select" on public.audit_logs
for select to authenticated using (public.has_app_role('auditor'));

create policy "meetings_auditor_select" on public.meetings
for select to authenticated using (public.has_app_role('auditor'));

create policy "profiles_auditor_select" on public.profiles
for select to authenticated using (public.has_app_role('auditor'));

create policy "meeting_close_requests_auditor_select" on public.meeting_close_requests
for select to authenticated using (public.has_app_role('auditor'));

create policy "meeting_close_request_answers_auditor_select" on public.meeting_close_request_answers
for select to authenticated using (public.has_app_role('auditor'));

create policy "result_correction_requests_auditor_select" on public.result_correction_requests
for select to authenticated using (public.has_app_role('auditor'));

create policy "result_documents_auditor_select" on public.result_documents
for select to authenticated using (public.has_app_role('auditor'));

create policy "result_documents_files_auditor_select" on storage.objects
for select to authenticated
using (bucket_id = 'result-documents' and public.has_app_role('auditor'));

-- Who still has access ------------------------------------------------------------------

-- Approved, and for a proxy holder who is neither owner nor resident: holding
-- a proxy for a meeting that is still open (item 14d).
create or replace function public.profile_access_active(p_profile_id uuid)
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
        or exists (select 1 from public.app_roles r where r.profile_id = p.id)
        or exists (
          select 1
          from public.proxy_authorizations pa
          join public.meetings m on m.id = pa.meeting_id
          where pa.proxy_profile_id = p.id
            and pa.status = 'approved'
            and m.status = 'published'
            and m.ends_at > now()
        )
      )
  );
$$;

revoke all on function public.profile_access_active(uuid) from public;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_access_active(public.current_profile_id())
  or exists (
    select 1
    from public.app_roles r
    where r.profile_id = public.current_profile_id()
      and r.role in ('admin', 'committee', 'system_admin', 'staff', 'auditor')
  );
$$;

-- Approving a result: separation of duties -------------------------------------------------

create or replace function public.approve_result_snapshot(
  p_result_snapshot_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approver_id uuid := public.current_profile_id();
  v_meeting_id uuid;
  v_required integer;
  v_count integer;
  v_published boolean := false;
  v_approval_id uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can approve results.' using errcode = 'P0001';
  end if;

  select s.meeting_id into v_meeting_id
  from public.result_snapshots s
  where s.id = p_result_snapshot_id;

  if v_meeting_id is null then
    raise exception 'RESULT_NOT_FOUND: Result snapshot not found.' using errcode = 'P0001';
  end if;

  perform 1 from public.meetings where id = v_meeting_id for update;

  if exists (select 1 from public.result_publications where meeting_id = v_meeting_id) then
    raise exception 'RESULT_ALREADY_PUBLISHED: This meeting already has a published result.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.result_snapshots
    where meeting_id = v_meeting_id
      and generated_at > (select generated_at from public.result_snapshots where id = p_result_snapshot_id)
  ) then
    raise exception 'RESULT_OTHER_SNAPSHOT: A newer result of this meeting was generated; approve that one.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.manual_ballots
    where meeting_id = v_meeting_id and identity_status = 'pending'
  ) then
    raise exception 'RESULT_PENDING_MANUAL_IDENTITY: Resolve pending manual vote identity records before approving.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.committee_approvals
    where result_snapshot_id = p_result_snapshot_id and approved_by = v_approver_id
  ) then
    raise exception 'RESULT_ALREADY_APPROVED: You already approved this result.' using errcode = 'P0001';
  end if;

  -- Separation of duties (demo feedback item 14a): whoever generated this
  -- result, or answered a correction of this meeting as fixed, cannot approve it.
  if exists (
    select 1 from public.result_snapshots
    where id = p_result_snapshot_id and generated_by = v_approver_id
  ) or exists (
    select 1 from public.result_correction_requests
    where meeting_id = v_meeting_id and status = 'fixed' and answered_by = v_approver_id
  ) then
    raise exception 'RESULT_SEPARATION: You generated or corrected this result, so another member must approve it.' using errcode = 'P0001';
  end if;

  v_required := public.result_required_approvals(v_meeting_id);

  insert into public.committee_approvals (meeting_id, result_snapshot_id, approved_by, notes)
  values (v_meeting_id, p_result_snapshot_id, v_approver_id, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_approval_id;

  select count(*) into v_count
  from public.committee_approvals
  where result_snapshot_id = p_result_snapshot_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.approved', v_approver_id, 'committee_approval', v_approval_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'result_snapshot_id', p_result_snapshot_id,
      'approvals', v_count, 'required_approvals', v_required));

  if v_count >= v_required then
    insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count)
    values (v_meeting_id, p_result_snapshot_id, v_count);
    perform public.queue_result_approved_emails(v_meeting_id);
    v_published := true;

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('result_snapshot.published', v_approver_id, 'result_snapshot', p_result_snapshot_id,
      jsonb_build_object('meeting_id', v_meeting_id, 'approvals', v_count));
  end if;

  return jsonb_build_object('approvals', v_count, 'required', v_required, 'published', v_published);
end;
$$;

-- One owner of record per room (item 15) --------------------------------------------------

-- Existing co-owner links end today; co-owners are registered as residents.
update public.room_owners
set status = 'ended', ends_at = least(coalesce(ends_at, current_date), current_date)
where ownership_role = 'co_owner' and status in ('active', 'scheduled');

create or replace function public.enforce_one_owner_of_record()
returns trigger
language plpgsql
as $$
begin
  if new.ownership_role <> 'owner' and new.status in ('active', 'scheduled') then
    raise exception 'OWNER_ROLE: A room has one owner of record; register a co-owner as a resident.' using errcode = 'P0001';
  end if;

  if new.status = 'active' and new.ends_at is null and exists (
    select 1 from public.room_owners ro
    where ro.room_id = new.room_id
      and ro.id <> new.id
      and ro.status = 'active'
      and ro.ends_at is null
  ) then
    raise exception 'ROOM_HAS_OWNER: This room already has an owner of record. End that link first.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger room_owners_one_owner_of_record
before insert or update of room_id, ownership_role, status, ends_at
on public.room_owners
for each row execute function public.enforce_one_owner_of_record();

-- Co-owner votes, granted by the owner in the app (item 15).
alter table public.proxy_authorizations
  add column kind text not null default 'proxy',
  add column granted_by_owner_profile_id uuid references public.profiles(id),
  add constraint proxy_authorizations_kind_check check (kind in ('proxy', 'co_owner'));

-- A co-owner's vote does not count toward the three-rooms limit (D012).
create or replace function public.enforce_proxy_room_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'proxy' and new.status in ('pending', 'approved') and (
    select count(*)
    from public.proxy_authorizations p
    where p.meeting_id = new.meeting_id
      and p.proxy_profile_id = new.proxy_profile_id
      and p.status in ('pending', 'approved')
      and p.kind = 'proxy'
      and p.id <> new.id
  ) >= 3 then
    raise exception 'VOTE_PROXY_LIMIT: One proxy can hold at most three rooms per meeting.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- The owner of record of a room, the same way every time.
create or replace function public.room_owner_profile_id(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.room_owners ro
  join public.owners o on o.id = ro.owner_id
  join public.profiles p on lower(p.email) = lower(o.email)
  where ro.room_id = p_room_id
    and ro.ends_at is null
    and ro.status = 'active'
    and ro.ownership_role = 'owner'
    and p.approval_status = 'approved'
    and p.default_status = 'owner'
  order by ro.created_at, p.created_at
  limit 1;
$$;

revoke all on function public.room_owner_profile_id(uuid) from public;

create or replace function public.sync_published_proxy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting_status text;
  v_ownership numeric;
  v_owner_profile_id uuid;
  v_approved_now boolean := new.status = 'approved';
  v_approved_before boolean := tg_op = 'UPDATE' and old.status = 'approved';
begin
  if v_approved_now = v_approved_before then
    return new;
  end if;

  select status into v_meeting_status from public.meetings where id = new.meeting_id;

  if v_meeting_status <> 'published' then
    return new;
  end if;

  if exists (
    select 1 from public.ballots b
    where b.meeting_id = new.meeting_id and b.room_id = new.room_id
  ) then
    raise exception 'VOTE_ROOM_ALREADY_VOTED: This room already voted in this meeting, so its proxy cannot change.' using errcode = 'P0001';
  end if;

  select ownership_percent into v_ownership from public.rooms where id = new.room_id;

  delete from public.eligible_voters_snapshot
  where meeting_id = new.meeting_id and room_id = new.room_id;

  if v_approved_now then
    insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
    values (new.meeting_id, new.room_id, new.proxy_profile_id, 'proxy', v_ownership, 'proxy_authorization');
  else
    v_owner_profile_id := public.room_owner_profile_id(new.room_id);

    if v_owner_profile_id is not null then
      insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
      values (new.meeting_id, new.room_id, v_owner_profile_id, 'owner', v_ownership, 'owner_master');
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.grant_co_owner_vote(
  p_meeting_id uuid,
  p_room_id uuid,
  p_co_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_owner_id uuid;
  v_co_owner uuid;
  v_meeting record;
  v_authorization uuid;
begin
  if v_profile_id is null or public.room_owner_profile_id(p_room_id) is distinct from v_profile_id then
    raise exception 'VOTE_NOT_OWNER: Only the owner of record of this room can let a co-owner vote.' using errcode = 'P0001';
  end if;

  select id, status, ends_at, closed_at into v_meeting from public.meetings where id = p_meeting_id;

  if v_meeting.id is null or v_meeting.status <> 'published' or v_meeting.ends_at <= now() then
    raise exception 'VOTE_CLOSED: Voting for this meeting has ended.' using errcode = 'P0001';
  end if;

  select p.id into v_co_owner
  from public.profiles p
  where lower(p.email) = lower(btrim(coalesce(p_co_owner_email, '')))
    and p.approval_status = 'approved'
    and p.default_status = 'resident'
    and p.id <> v_profile_id;

  if v_co_owner is null then
    raise exception 'VOTE_CO_OWNER_NOT_FOUND: No approved resident account has this email. Ask the office to register your co-owner as a resident first.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.proxy_authorizations
    where meeting_id = p_meeting_id and room_id = p_room_id and status in ('pending', 'approved')
  ) then
    raise exception 'VOTE_ROOM_DELEGATED: This room already has a proxy or co-owner for this meeting.' using errcode = 'P0001';
  end if;

  select ro.owner_id into v_owner_id
  from public.room_owners ro
  where ro.room_id = p_room_id and ro.status = 'active' and ro.ends_at is null and ro.ownership_role = 'owner'
  order by ro.created_at
  limit 1;

  insert into public.proxy_authorizations
    (meeting_id, room_id, owner_id, proxy_profile_id, status, kind, reviewed_by, reviewed_at, granted_by_owner_profile_id)
  values
    (p_meeting_id, p_room_id, v_owner_id, v_co_owner, 'approved', 'co_owner', v_profile_id, now(), v_profile_id)
  returning id into v_authorization;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('proxy.co_owner_granted', v_profile_id, 'proxy_authorization', v_authorization,
    jsonb_build_object('meeting_id', p_meeting_id, 'room_id', p_room_id, 'co_owner_profile_id', v_co_owner));

  perform public.queue_staff_email(v_co_owner, 'co_owner_vote:' || p_meeting_id);

  return v_authorization;
end;
$$;

revoke all on function public.grant_co_owner_vote(uuid, uuid, text) from public;
grant execute on function public.grant_co_owner_vote(uuid, uuid, text) to authenticated;

-- The owner can take it back until the co-owner votes (the sync trigger
-- refuses once the room has a ballot).
create or replace function public.cancel_co_owner_vote(p_authorization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  update public.proxy_authorizations
  set status = 'revoked', reviewed_by = v_profile_id, reviewed_at = now()
  where id = p_authorization_id
    and kind = 'co_owner'
    and status = 'approved'
    and granted_by_owner_profile_id = v_profile_id;

  if not found then
    raise exception 'VOTE_FORBIDDEN: Only the owner who let the co-owner vote can take it back.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id)
  values ('proxy.co_owner_cancelled', v_profile_id, 'proxy_authorization', p_authorization_id);
end;
$$;

revoke all on function public.cancel_co_owner_vote(uuid) from public;
grant execute on function public.cancel_co_owner_vote(uuid) to authenticated;

-- my_member_access(): access follows profile_access_active(); delegated rooms
-- say whether the owner can take a co-owner vote back.
create or replace function public.my_member_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_approved boolean;
  v_owns_room boolean;
  v_has_ballot_right boolean;
  v_delegated jsonb;
begin
  select * into v_profile from public.profiles where id = public.current_profile_id();

  if not found then
    return jsonb_build_object(
      'approved', false, 'can_view_results', false, 'can_vote', false,
      'owns_room', false, 'delegated_rooms', '[]'::jsonb);
  end if;

  v_approved := public.profile_access_active(v_profile.id);

  select exists (
    select 1
    from public.room_owners ro
    join public.owners o on o.id = ro.owner_id
    where ro.status = 'active'
      and lower(o.email) = lower(v_profile.email)
  ) into v_owns_room;

  select exists (
    select 1 from public.eligible_voters_snapshot e where e.profile_id = v_profile.id
  ) into v_has_ballot_right;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pa.id,
      'kind', pa.kind,
      'room_number', r.room_number,
      'meeting_title', m.title,
      'proxy_name', proxy.full_name,
      'ends_at', m.ends_at,
      'can_cancel', pa.kind = 'co_owner'
        and pa.granted_by_owner_profile_id = v_profile.id
        and not exists (select 1 from public.ballots b where b.meeting_id = pa.meeting_id and b.room_id = pa.room_id)
    ) order by m.ends_at, r.room_number), '[]'::jsonb)
  into v_delegated
  from public.proxy_authorizations pa
  join public.rooms r on r.id = pa.room_id
  join public.meetings m on m.id = pa.meeting_id
  join public.profiles proxy on proxy.id = pa.proxy_profile_id
  where pa.status = 'approved'
    and m.status = 'published'
    and m.closed_at is null
    and m.ends_at > now()
    and exists (
      select 1
      from public.room_owners ro
      join public.owners o on o.id = ro.owner_id
      where ro.room_id = pa.room_id
        and ro.status = 'active'
        and lower(o.email) = lower(v_profile.email)
    );

  return jsonb_build_object(
    'approved', v_approved,
    'can_view_results', public.is_approved_member(),
    'can_vote', v_approved and (
      v_profile.default_status in ('owner', 'proxy') or v_owns_room or v_has_ballot_right
    ),
    'owns_room', v_owns_room,
    'delegated_rooms', case when v_approved then v_delegated else '[]'::jsonb end
  );
end;
$$;
