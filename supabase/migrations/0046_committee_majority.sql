-- req_0011 A / D027 (user decisions 2026-11-20; Condominium Act s.37/6):
-- committee decisions on results and on closing voting early are taken by
-- a majority of all active members (the chair included), the Manager's
-- setting can only raise that number, and a tie is decided by the chair's
-- casting vote (vice chair when there is no chair). One rule, one helper:
-- committee_tally(kind, subject).

-- Size of the committee today and the effective minimum -----------------
create or replace function public.committee_member_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.active_committee_profile_ids();
$$;

-- floor(N/2)+1, raised (never lowered) by the meeting's setting.
create or replace function public.committee_majority(p_setting integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(coalesce(p_setting, 0), public.committee_member_count() / 2 + 1);
$$;

create or replace function public.result_has_high_correction(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.result_correction_requests r
    where r.meeting_id = p_meeting_id and r.level = 'high' and r.status <> 'no_change'
  );
$$;

-- A high-level correction (D014) still needs every active member.
create or replace function public.result_required_approvals(p_meeting_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.result_has_high_correction(m.id)
    then greatest(m.required_approvals, public.committee_member_count())
    else public.committee_majority(m.required_approvals)
  end
  from public.meetings m
  where m.id = p_meeting_id;
$$;



-- The chair who breaks a tie: the active chair, else the active vice chair
-- (D026 positions). None: the Manager is warned on /committee.
create or replace function public.committee_chair()
returns table (profile_id uuid, position_code text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select cm.profile_id, cm.position_code, coalesce(p.full_name, cm.full_name)
  from public.committee_members cm
  left join public.profiles p on p.id = cm.profile_id
  where cm.active
    and cm.position_code in ('chair', 'vice_chair')
    and cm.profile_id in (select public.active_committee_profile_ids())
    and (cm.term_starts_at is null or cm.term_starts_at <= current_date)
    and (cm.term_ends_at is null or cm.term_ends_at >= current_date)
  order by case cm.position_code when 'chair' then 0 else 1 end, cm.created_at
  limit 1;
$$;

-- Objections to a result, and casting votes ------------------------------
create table public.result_objections (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  result_snapshot_id uuid not null references public.result_snapshots(id) on delete cascade,
  objected_by uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (result_snapshot_id, objected_by)
);

create table public.committee_casting_votes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('result', 'close_request')),
  subject_id uuid not null,
  cast_by uuid not null references public.profiles(id),
  position_code text not null check (position_code in ('chair', 'vice_chair')),
  decision text not null check (decision in ('approve', 'object')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (subject_kind, subject_id)
);

-- Written only by the functions below; no update or delete (immutable).
alter table public.result_objections enable row level security;
alter table public.committee_casting_votes enable row level security;

create policy "result_objections_committee_select" on public.result_objections
for select to authenticated using (public.can_approve_as_committee() or public.has_app_role('auditor'));

create policy "committee_casting_votes_select" on public.committee_casting_votes
for select to authenticated using (public.can_approve_as_committee() or public.has_app_role('auditor'));

-- The one rule ------------------------------------------------------------
-- Passed when approvals >= n; not passed when objections >= n; when every
-- member who may answer has answered: a tie (approvals = objections, not a
-- high-level correction) waits for the chair's casting vote, anything else
-- is not passed (D027: nobody is left to change it). A cast vote decides.
create or replace function public.committee_tally(p_kind text, p_subject uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_members uuid[];
  v_eligible uuid[];
  v_meeting uuid;
  v_required integer;
  v_high boolean := false;
  v_approvals integer := 0;
  v_objections integer := 0;
  v_answered integer := 0;
  v_cast record;
  v_chair record;
  v_status text;
begin
  select coalesce(array_agg(id), '{}') into v_members from public.active_committee_profile_ids() id;

  if p_kind = 'result' then
    select meeting_id into v_meeting from public.result_snapshots where id = p_subject;

    if v_meeting is null then
      return null;
    end if;

    v_high := public.result_has_high_correction(v_meeting);
    v_required := public.result_required_approvals(v_meeting);
    -- D022: whoever generated the result or answered a correction as fixed
    -- may not answer.
    select coalesce(array_agg(m), '{}') into v_eligible
    from unnest(v_members) m
    where m not in (select s.generated_by from public.result_snapshots s
                    where s.id = p_subject and s.generated_by is not null)
      and m not in (select r.answered_by from public.result_correction_requests r
                    where r.meeting_id = v_meeting and r.status = 'fixed' and r.answered_by is not null);

    select count(*) into v_approvals from public.committee_approvals
    where result_snapshot_id = p_subject and approved_by = any(v_members);
    select count(*) into v_objections from public.result_objections
    where result_snapshot_id = p_subject and objected_by = any(v_members);
    select count(*) into v_answered from (
      select approved_by as who from public.committee_approvals where result_snapshot_id = p_subject
      union
      select objected_by from public.result_objections where result_snapshot_id = p_subject
    ) a where a.who = any(v_eligible);
  elsif p_kind = 'close_request' then
    select meeting_id into v_meeting from public.meeting_close_requests where id = p_subject;

    if v_meeting is null then
      return null;
    end if;

    v_required := public.committee_majority((select required_approvals from public.meetings where id = v_meeting));
    v_eligible := v_members;

    select count(*) filter (where answer = 'approve'),
           count(*) filter (where answer = 'object'),
           count(*)
    into v_approvals, v_objections, v_answered
    from public.meeting_close_request_answers
    where request_id = p_subject and answered_by = any(v_members);
  else
    raise exception 'COMMITTEE_KIND: Unknown decision kind.' using errcode = 'P0001';
  end if;

  select c.decision, c.cast_by, c.position_code, c.created_at, c.reason into v_cast
  from public.committee_casting_votes c
  where c.subject_kind = p_kind and c.subject_id = p_subject;

  select * into v_chair from public.committee_chair();

  v_status := case
    when v_cast.decision = 'approve' then 'passed'
    when v_cast.decision = 'object' then 'not_passed'
    when v_approvals >= v_required then 'passed'
    when v_objections >= v_required then 'not_passed'
    -- High level: every member must approve, so one objection is enough
    -- once the rest cannot reach the number.
    when v_high and v_approvals + (cardinality(v_eligible) - v_answered) < v_required then 'not_passed'
    when cardinality(v_eligible) > 0 and v_answered >= cardinality(v_eligible) then
      case when v_approvals = v_objections and not v_high then 'tie' else 'not_passed' end
    else 'open'
  end;

  return jsonb_build_object(
    'kind', p_kind,
    'subject_id', p_subject,
    'meeting_id', v_meeting,
    'members', cardinality(v_members),
    'required', v_required,
    'high_level', v_high,
    'approvals', v_approvals,
    'objections', v_objections,
    'eligible', cardinality(v_eligible),
    'answered', v_answered,
    'status', v_status,
    'casting_vote', case when v_cast.decision is null then null else jsonb_build_object(
      'decision', v_cast.decision, 'position', v_cast.position_code, 'reason', v_cast.reason,
      'at', v_cast.created_at, 'name', public.committee_person_name(v_cast.cast_by)) end,
    'chair', case when v_chair.profile_id is null then null else jsonb_build_object(
      'profile_id', v_chair.profile_id, 'position', v_chair.position_code, 'name', v_chair.full_name) end
  );
end;
$$;

-- Tell the Manager (every admin) once that a result did not pass.
create or replace function public.notify_result_not_passed(p_result_snapshot_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting uuid;
begin
  select meeting_id into v_meeting from public.result_snapshots where id = p_result_snapshot_id;

  if v_meeting is null or exists (
    select 1 from public.audit_logs
    where action = 'result_snapshot.not_passed' and entity_id = p_result_snapshot_id
  ) then
    return;
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.not_passed', p_actor, 'result_snapshot', p_result_snapshot_id,
    jsonb_build_object('meeting_id', v_meeting) || (public.committee_tally('result', p_result_snapshot_id)
      - 'kind' - 'subject_id' - 'meeting_id' - 'casting_vote' - 'chair'));

  perform public.queue_staff_email(r.profile_id, 'result_not_passed:' || v_meeting)
  from public.app_roles r
  where r.role = 'admin';
end;
$$;

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
  v_tally jsonb;
  v_published boolean := false;
  v_held boolean := false;
  v_approval_id uuid;
begin
  -- D027: the majority is counted among active committee members, so only
  -- they answer (the Manager approves only when also a member).
  if v_approver_id is null or v_approver_id not in (select public.active_committee_profile_ids()) then
    raise exception 'RESULT_FORBIDDEN: Only active committee members approve results.' using errcode = 'P0001';
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

  if exists (
    select 1 from public.result_objections
    where result_snapshot_id = p_result_snapshot_id and objected_by = v_approver_id
  ) then
    raise exception 'RESULT_ALREADY_ANSWERED: You objected to this result; an answer cannot change.' using errcode = 'P0001';
  end if;

  if (public.committee_tally('result', p_result_snapshot_id)->>'status') <> 'open' then
    raise exception 'RESULT_DECIDED: The committee has already decided on this result.' using errcode = 'P0001';
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

  v_tally := public.committee_tally('result', p_result_snapshot_id);

  if v_tally->>'status' = 'passed' then
    -- Publishing waits while a correction request is open (0034); it then
    -- happens when the admin answers "No change needed".
    v_published := public.publish_result_if_ready(p_result_snapshot_id, v_approver_id);
    v_held := not v_published;
  end if;

  if v_tally->>'status' = 'not_passed' then
    perform public.notify_result_not_passed(p_result_snapshot_id, v_approver_id);
  end if;

  return v_tally || jsonb_build_object('published', v_published, 'held', v_held);
end;
$$;

-- Object to a result with a reason (new in D027). Same checks as approving.
create or replace function public.object_result_snapshot(p_result_snapshot_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting_id uuid;
  v_objection_id uuid;
  v_tally jsonb;
begin
  if v_profile_id is null or v_profile_id not in (select public.active_committee_profile_ids()) then
    raise exception 'RESULT_FORBIDDEN: Only active committee members answer on results.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for objecting.' using errcode = 'P0001';
  end if;

  if char_length(btrim(p_reason)) > 500 then
    raise exception 'RESULT_REASON_TOO_LONG: Keep the reason within 500 characters.' using errcode = 'P0001';
  end if;

  select meeting_id into v_meeting_id from public.result_snapshots where id = p_result_snapshot_id;

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
    raise exception 'RESULT_OTHER_SNAPSHOT: A newer result of this meeting was generated; answer on that one.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.committee_approvals where result_snapshot_id = p_result_snapshot_id and approved_by = v_profile_id)
     or exists (select 1 from public.result_objections where result_snapshot_id = p_result_snapshot_id and objected_by = v_profile_id) then
    raise exception 'RESULT_ALREADY_ANSWERED: You already answered on this result; an answer cannot change.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.result_snapshots
    where id = p_result_snapshot_id and generated_by = v_profile_id
  ) or exists (
    select 1 from public.result_correction_requests
    where meeting_id = v_meeting_id and status = 'fixed' and answered_by = v_profile_id
  ) then
    raise exception 'RESULT_SEPARATION: You generated or corrected this result, so other members decide on it.' using errcode = 'P0001';
  end if;

  if (public.committee_tally('result', p_result_snapshot_id)->>'status') <> 'open' then
    raise exception 'RESULT_DECIDED: The committee has already decided on this result.' using errcode = 'P0001';
  end if;

  insert into public.result_objections (meeting_id, result_snapshot_id, objected_by, reason)
  values (v_meeting_id, p_result_snapshot_id, v_profile_id, btrim(p_reason))
  returning id into v_objection_id;

  v_tally := public.committee_tally('result', p_result_snapshot_id);

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.objected', v_profile_id, 'result_snapshot', p_result_snapshot_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'reason', btrim(p_reason),
      'approvals', v_tally->'approvals', 'objections', v_tally->'objections', 'required_approvals', v_tally->'required'));

  if v_tally->>'status' = 'not_passed' then
    perform public.notify_result_not_passed(p_result_snapshot_id, v_profile_id);
  end if;

  return v_tally;
end;
$$;

revoke all on function public.object_result_snapshot(uuid, text) from public;
grant execute on function public.object_result_snapshot(uuid, text) to authenticated;

-- The chair's (or vice chair's) casting vote on a tie --------------------
create or replace function public.cast_committee_deciding_vote(
  p_kind text,
  p_subject uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_chair record;
  v_tally jsonb;
  v_meeting uuid;
  v_vote_id uuid;
  v_published boolean := false;
begin
  if p_decision not in ('approve', 'object') then
    raise exception 'COMMITTEE_INVALID_DECISION: Decide approve or object.' using errcode = 'P0001';
  end if;

  if p_reason is not null and char_length(btrim(p_reason)) > 500 then
    raise exception 'RESULT_REASON_TOO_LONG: Keep the reason within 500 characters.' using errcode = 'P0001';
  end if;

  select * into v_chair from public.committee_chair();

  if v_chair.profile_id is null then
    raise exception 'COMMITTEE_NO_CHAIR: The committee has no active chair or vice chair.' using errcode = 'P0001';
  end if;

  if v_profile_id is distinct from v_chair.profile_id then
    raise exception 'COMMITTEE_NOT_CHAIR: Only the chair (or the vice chair when there is no chair) casts the deciding vote.' using errcode = 'P0001';
  end if;

  v_tally := public.committee_tally(p_kind, p_subject);

  if v_tally is null then
    raise exception 'COMMITTEE_NOT_FOUND: Nothing to decide.' using errcode = 'P0001';
  end if;

  if v_tally->>'status' <> 'tie' then
    raise exception 'COMMITTEE_NOT_TIED: A casting vote is only for a tie.' using errcode = 'P0001';
  end if;

  v_meeting := (v_tally->>'meeting_id')::uuid;

  insert into public.committee_casting_votes (meeting_id, subject_kind, subject_id, cast_by, position_code, decision, reason)
  values (v_meeting, p_kind, p_subject, v_profile_id, v_chair.position_code, p_decision,
    nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_vote_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('committee.casting_vote', v_profile_id, 'committee_casting_vote', v_vote_id,
    jsonb_build_object('meeting_id', v_meeting, 'subject_kind', p_kind, 'subject_id', p_subject,
      'decision', p_decision, 'position', v_chair.position_code,
      'approvals', v_tally->'approvals', 'objections', v_tally->'objections'));

  if p_kind = 'result' then
    if p_decision = 'approve' then
      v_published := public.publish_result_if_ready(p_subject, v_profile_id);
    else
      perform public.notify_result_not_passed(p_subject, v_profile_id);
    end if;
  else
    perform public.evaluate_close_request(p_subject);
  end if;

  return public.committee_tally(p_kind, p_subject) || jsonb_build_object('published', v_published);
end;
$$;

revoke all on function public.cast_committee_deciding_vote(text, uuid, text, text) from public;
grant execute on function public.cast_committee_deciding_vote(text, uuid, text, text) to authenticated;


create or replace function public.evaluate_close_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.meeting_close_requests%rowtype;
  v_meeting record;
  v_tally jsonb;
  v_status text := 'open';
begin
  select * into v_request from public.meeting_close_requests where id = p_request_id for update;

  if v_request.status <> 'open' then
    return v_request.status;
  end if;

  select id, status, ends_at, required_approvals into v_meeting
  from public.meetings where id = v_request.meeting_id for update;

  if v_meeting.status <> 'published' or now() > v_meeting.ends_at then
    update public.meeting_close_requests set status = 'lapsed', ended_at = now() where id = p_request_id;
    return 'lapsed';
  end if;

  -- D027: majority of all active members; a tie waits for the chair.
  v_tally := public.committee_tally('close_request', p_request_id);

  if v_tally->>'status' = 'passed' then
    v_status := 'approved';
    update public.meeting_close_requests set status = 'approved', ended_at = now() where id = p_request_id;

    if v_request.close_at is null or v_request.close_at <= now() then
      update public.meetings set status = 'closed', closed_at = now() where id = v_request.meeting_id;
    else
      update public.meetings set ends_at = v_request.close_at where id = v_request.meeting_id;
    end if;

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('meeting.closed_early', public.current_profile_id(), 'meeting', v_request.meeting_id,
      jsonb_build_object('request_id', p_request_id, 'approvals', v_tally->'approvals',
        'objections', v_tally->'objections', 'required_approvals', v_tally->'required',
        'casting_vote', v_tally->'casting_vote',
        'close_at', coalesce(v_request.close_at, now()), 'original_ends_at', v_request.original_ends_at));
  elsif v_tally->>'status' = 'not_passed' then
    v_status := 'failed';
    update public.meeting_close_requests set status = 'failed', ended_at = now() where id = p_request_id;
    perform public.queue_staff_email(v_request.proposed_by, 'close_request_failed:' || v_request.meeting_id);

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('meeting.close_request_failed', public.current_profile_id(), 'meeting_close_request', p_request_id,
      jsonb_build_object('meeting_id', v_request.meeting_id, 'approvals', v_tally->'approvals',
        'objections', v_tally->'objections', 'required_approvals', v_tally->'required',
        'members', v_tally->'members', 'answered', v_tally->'answered', 'casting_vote', v_tally->'casting_vote'));
  end if;

  return v_status;
end;
$$;

create or replace function public.answer_close_request(
  p_request_id uuid,
  p_answer text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request public.meeting_close_requests%rowtype;
  v_status text;
begin
  if v_profile_id is null or v_profile_id not in (select public.active_committee_profile_ids()) then
    raise exception 'RESULT_FORBIDDEN: Only active committee members can answer a request to close early.' using errcode = 'P0001';
  end if;

  if p_answer not in ('approve', 'object') then
    raise exception 'RESULT_INVALID_ANSWER: Answer approve or object.' using errcode = 'P0001';
  end if;

  if p_answer = 'object' and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for objecting.' using errcode = 'P0001';
  end if;

  select * into v_request from public.meeting_close_requests where id = p_request_id;

  if v_request.id is null or public.evaluate_close_request(p_request_id) <> 'open' then
    raise exception 'RESULT_REQUEST_CLOSED: This request has ended.' using errcode = 'P0001';
  end if;

  -- The proposer's request counts as their approval; to change their mind
  -- they cancel the request instead of objecting to it.
  if p_answer = 'object' and v_request.proposed_by = v_profile_id then
    raise exception 'RESULT_PROPOSER_OBJECT: You proposed this request; cancel it instead of objecting.' using errcode = 'P0001';
  end if;

  -- D027: answers are immutable (approve, or object with a reason).
  if exists (
    select 1 from public.meeting_close_request_answers
    where request_id = p_request_id and answered_by = v_profile_id
  ) then
    raise exception 'RESULT_ALREADY_ANSWERED: You already answered this request; an answer cannot change.' using errcode = 'P0001';
  end if;

  if p_reason is not null and char_length(btrim(p_reason)) > 500 then
    raise exception 'RESULT_REASON_TOO_LONG: Keep the reason within 500 characters.' using errcode = 'P0001';
  end if;

  insert into public.meeting_close_request_answers (request_id, answered_by, answer, reason)
  values (p_request_id, v_profile_id, p_answer, nullif(btrim(coalesce(p_reason, '')), ''));

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_request_answered', v_profile_id, 'meeting_close_request', p_request_id,
    jsonb_build_object('meeting_id', v_request.meeting_id, 'answer', p_answer,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  v_status := public.evaluate_close_request(p_request_id);

  return jsonb_build_object('request_id', p_request_id, 'status', v_status)
    || jsonb_build_object('tally', public.committee_tally('close_request', p_request_id));
end;
$$;

create or replace function public.answer_correction_request(
  p_request_id uuid,
  p_status text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request public.result_correction_requests%rowtype;
  v_latest uuid;
  v_published boolean := false;
begin
  if not public.has_app_role('admin') then
    raise exception 'RESULT_FORBIDDEN: Only admins answer correction requests.' using errcode = 'P0001';
  end if;

  if p_status not in ('fixed', 'no_change') then
    raise exception 'RESULT_INVALID_ANSWER: Answer fixed or no change needed.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_answer, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Explain the answer.' using errcode = 'P0001';
  end if;

  select * into v_request from public.result_correction_requests where id = p_request_id for update;

  if v_request.id is null or v_request.status <> 'open' then
    raise exception 'RESULT_REQUEST_CLOSED: This request has been answered.' using errcode = 'P0001';
  end if;

  if v_request.requested_by = v_profile_id then
    raise exception 'RESULT_OWN_REQUEST: Someone else must answer your own request.' using errcode = 'P0001';
  end if;

  update public.result_correction_requests
  set status = p_status, answer = btrim(p_answer), answered_by = v_profile_id, answered_at = now()
  where id = p_request_id;

  perform public.queue_staff_email(v_request.requested_by, 'result_correction_answered:' || v_request.meeting_id);

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result.correction_answered', v_profile_id, 'result_correction_request', p_request_id,
    jsonb_build_object('status', p_status, 'answer', btrim(p_answer)));

  -- Approvals may already be complete: publishing waited for this answer.
  select s.id into v_latest from public.result_snapshots s
  where s.meeting_id = v_request.meeting_id order by s.generated_at desc limit 1;

  if v_latest is not null
     and (public.committee_tally('result', v_latest)->>'status') = 'passed' then
    v_published := public.publish_result_if_ready(v_latest, v_profile_id);
  end if;

  return jsonb_build_object('status', p_status, 'published', v_published, 'result_snapshot_id', v_latest);
end;
$$;

create or replace function public.committee_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_members uuid[];
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Committee access only.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into v_members from public.active_committee_profile_ids() id;

  return jsonb_build_object(
    'is_member', v_profile_id = any(v_members),
    'member_count', cardinality(v_members),
    'chair', (select jsonb_build_object('profile_id', c.profile_id, 'position', c.position_code, 'name', c.full_name)
              from public.committee_chair() c),
    'i_am_chair', exists (select 1 from public.committee_chair() c where c.profile_id = v_profile_id),
    'members', public.committee_people(v_members),
    'open_meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'title_en', m.title_en,
        'starts_at', m.starts_at,
        'ends_at', m.ends_at,
        'required_approvals', m.required_approvals,
        'request', (
          select jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'close_at', r.close_at,
            'created_at', r.created_at,
            'proposed_by', r.proposed_by,
            'proposed_by_me', r.proposed_by = v_profile_id,
            'proposer', public.committee_person_name(r.proposed_by),
            'tally', public.committee_tally('close_request', r.id),
            'my_answer', (select a.answer from public.meeting_close_request_answers a
                          where a.request_id = r.id and a.answered_by = v_profile_id),
            'answers', coalesce((
              select jsonb_agg(jsonb_build_object(
                'profile_id', a.answered_by,
                'name', public.committee_person_name(a.answered_by),
                'answer', a.answer,
                'reason', a.reason,
                'answered_at', a.answered_at
              ) order by a.answered_at)
              from public.meeting_close_request_answers a
              where a.request_id = r.id
            ), '[]'::jsonb)
          )
          from public.meeting_close_requests r
          where r.meeting_id = m.id and r.status = 'open'
          limit 1
        ),
        -- The latest request that ended without closing voting (failed or
        -- cancelled), so the card can say what happened to it.
        'last_request', (
          select jsonb_build_object(
            'status', r.status,
            'reason', r.reason,
            'proposer', public.committee_person_name(r.proposed_by),
            'ended_at', r.ended_at,
            'answers', coalesce((
              select jsonb_agg(jsonb_build_object(
                'name', public.committee_person_name(a.answered_by),
                'answer', a.answer,
                'reason', a.reason
              ) order by a.answered_at)
              from public.meeting_close_request_answers a
              where a.request_id = r.id
            ), '[]'::jsonb)
          )
          from public.meeting_close_requests r
          where r.meeting_id = m.id and r.status in ('failed', 'cancelled')
            and not exists (select 1 from public.meeting_close_requests o where o.meeting_id = m.id and o.status = 'open')
          order by r.ended_at desc nulls last
          limit 1
        ),
        'closes_early_at', (
          select r.close_at from public.meeting_close_requests r
          where r.meeting_id = m.id and r.status = 'approved' and r.close_at > now()
          order by r.ended_at desc limit 1
        )
      ) order by m.ends_at)
      from public.meetings m
      where m.status = 'published'
        and now() <= m.ends_at
        and now() >= coalesce(least(m.advance_starts_at, m.starts_at), m.starts_at)
    ), '[]'::jsonb),
    'pending_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'snapshot_id', s.id,
        'meeting_id', m.id,
        'title', m.title,
        'title_en', m.title_en,
        'generated_at', s.generated_at,
        'required_approvals', public.result_required_approvals(m.id),
        'approvals', (select count(*) from public.committee_approvals a where a.result_snapshot_id = s.id),
        'approved_by_me', exists (select 1 from public.committee_approvals a where a.result_snapshot_id = s.id and a.approved_by = v_profile_id),
        'objected_by_me', exists (select 1 from public.result_objections o where o.result_snapshot_id = s.id and o.objected_by = v_profile_id),
        'tally', public.committee_tally('result', s.id),
        'objection_list', coalesce((
          select jsonb_agg(jsonb_build_object(
            'profile_id', o.objected_by,
            'name', public.committee_person_name(o.objected_by),
            'reason', o.reason,
            'objected_at', o.created_at
          ) order by o.created_at)
          from public.result_objections o
          where o.result_snapshot_id = s.id
        ), '[]'::jsonb),
        'approval_list', coalesce((
          select jsonb_agg(jsonb_build_object(
            'profile_id', a.approved_by,
            'name', public.committee_person_name(a.approved_by),
            'approved_at', a.approved_at,
            'notes', a.notes
          ) order by a.approved_at)
          from public.committee_approvals a
          where a.result_snapshot_id = s.id
        ), '[]'::jsonb),
        'corrections', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id,
            'result_snapshot_id', c.result_snapshot_id,
            'category', c.category,
            'level', c.level,
            'reason', c.reason,
            'legal_reference', c.legal_reference,
            'status', c.status,
            'answer', c.answer,
            'answered_at', c.answered_at,
            'level_change_reason', c.level_change_reason,
            'level_changed_at', c.level_changed_at,
            'requested_by_me', c.requested_by = v_profile_id,
            'requester', (select p.full_name from public.profiles p where p.id = c.requested_by),
            'created_at', c.created_at
          ) order by c.created_at desc)
          from public.result_correction_requests c
          where c.meeting_id = m.id
        ), '[]'::jsonb),
        'previous_payload', (
          select s2.payload_json from public.result_snapshots s2
          where s2.meeting_id = m.id and s2.generated_at < s.generated_at
          order by s2.generated_at desc limit 1
        ),
        'payload', s.payload_json
      ) order by s.generated_at desc)
      from public.result_snapshots s
      join public.meetings m on m.id = s.meeting_id
      where not exists (select 1 from public.result_publications p where p.meeting_id = m.id)
        and s.id = (
          select s2.id from public.result_snapshots s2
          where s2.meeting_id = m.id
          order by s2.generated_at desc limit 1
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- Generating again after "not passed" (D027) ------------------------------
-- 0030 allowed a new snapshot after approvals only while a correction
-- request was open, so a result the committee did not pass could never be
-- generated again. Now also allowed when the latest result did not pass.
-- Security definer: committee_tally is internal (0047).
create or replace function public.prevent_result_snapshot_change_after_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest uuid;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.result_publications where meeting_id = new.meeting_id) then
      raise exception 'Cannot generate result snapshots after the result is published.';
    end if;

    select id into v_latest
    from public.result_snapshots
    where meeting_id = new.meeting_id
    order by generated_at desc
    limit 1;

    if v_latest is not null
       and exists (select 1 from public.committee_approvals where result_snapshot_id = v_latest)
       and not exists (
         select 1 from public.result_correction_requests
         where result_snapshot_id = v_latest and status = 'open'
       )
       and coalesce(public.committee_tally('result', v_latest)->>'status', 'open') <> 'not_passed' then
      raise exception 'Cannot generate result snapshots after committee approval.';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from public.committee_approvals
    where result_snapshot_id = old.id
  ) then
    raise exception 'Approved result snapshots are immutable.';
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;

-- The committee's decision on each result not yet published, for the
-- results list, the overview and the audit page (office staff, committee,
-- auditor). One row per latest snapshot of a meeting.
create or replace function public.result_decisions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_office_staff() or public.can_approve_as_committee() or public.has_app_role('auditor')) then
    raise exception 'RESULT_FORBIDDEN: Not allowed.' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(public.committee_tally('result', s.id) || jsonb_build_object(
      'objection_list', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', public.committee_person_name(o.objected_by),
          'reason', o.reason,
          'objected_at', o.created_at
        ) order by o.created_at)
        from public.result_objections o
        where o.result_snapshot_id = s.id
      ), '[]'::jsonb)))
    from public.result_snapshots s
    where not exists (select 1 from public.result_publications p where p.meeting_id = s.meeting_id)
      and s.id = (
        select s2.id from public.result_snapshots s2
        where s2.meeting_id = s.meeting_id
        order by s2.generated_at desc limit 1
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.result_decisions() from public, anon;
grant execute on function public.result_decisions() to authenticated;

-- n of N at the moment of publishing (D027): the committee changes later,
-- so the record keeps how many members there were and how many were needed.
-- Null on results published before 0046.
alter table public.result_publications
  add column committee_members integer check (committee_members is null or committee_members >= 0),
  add column required_approvals integer check (required_approvals is null or required_approvals >= 0),
  add column objections_count integer check (objections_count is null or objections_count >= 0),
  add column decided_by_casting_vote boolean not null default false;

create or replace function public.publish_result_if_ready(p_result_snapshot_id uuid, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting_id uuid;
  v_count integer;
  v_tally jsonb;
begin
  select meeting_id into v_meeting_id from public.result_snapshots where id = p_result_snapshot_id;

  if v_meeting_id is null
     or exists (select 1 from public.result_publications where meeting_id = v_meeting_id)
     or exists (select 1 from public.result_correction_requests where meeting_id = v_meeting_id and status = 'open') then
    return false;
  end if;

  select count(*) into v_count from public.committee_approvals where result_snapshot_id = p_result_snapshot_id;
  v_tally := public.committee_tally('result', p_result_snapshot_id);

  insert into public.result_publications (
    meeting_id, result_snapshot_id, approvals_count,
    committee_members, required_approvals, objections_count, decided_by_casting_vote)
  values (
    v_meeting_id, p_result_snapshot_id, v_count,
    (v_tally->>'members')::int, (v_tally->>'required')::int, (v_tally->>'objections')::int,
    v_tally->'casting_vote' is not null and jsonb_typeof(v_tally->'casting_vote') = 'object');
  perform public.queue_result_approved_emails(v_meeting_id);

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.published', p_actor, 'result_snapshot', p_result_snapshot_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'approvals', v_count,
      'objections', v_tally->'objections', 'required_approvals', v_tally->'required',
      'members', v_tally->'members', 'casting_vote', v_tally->'casting_vote'));

  return true;
end;
$$;
revoke all on function public.publish_result_if_ready(uuid, uuid) from public, anon, authenticated;
