-- Committee page review, 2026-11-14 (user decisions).
--
-- 1. English meeting titles: committee_overview() also returns title_en.
-- 2. Close-early requests: the proposer cannot object to their own request
--    (they cancel it instead); committee_overview() returns the latest
--    request that failed or was cancelled, so the card can show it.
-- 3. Correction requests: one open request per result at a time, whoever
--    asked; a member who approved the result cannot request a correction.
-- 4. Publishing waits while a correction request is open. Approvals are
--    still recorded; when the admin answers "No change needed" and the
--    approvals are complete, the result is published then.
-- Other parts of the redefined functions are unchanged from 0030 and 0031.

-- Rule 3 is checked in request_result_correction() under a lock on the
-- meeting, not with a unique index: requests already open before this
-- migration stay as they are until the admin answers them.

-- Publishes a result whose approvals are complete, unless a correction
-- request on it is still open. Returns whether it was published.
create or replace function public.publish_result_if_ready(p_result_snapshot_id uuid, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting_id uuid;
  v_count integer;
begin
  select meeting_id into v_meeting_id from public.result_snapshots where id = p_result_snapshot_id;

  if v_meeting_id is null
     or exists (select 1 from public.result_publications where meeting_id = v_meeting_id)
     or exists (select 1 from public.result_correction_requests where meeting_id = v_meeting_id and status = 'open') then
    return false;
  end if;

  select count(*) into v_count from public.committee_approvals where result_snapshot_id = p_result_snapshot_id;

  insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count)
  values (v_meeting_id, p_result_snapshot_id, v_count);
  perform public.queue_result_approved_emails(v_meeting_id);

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.published', p_actor, 'result_snapshot', p_result_snapshot_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'approvals', v_count));

  return true;
end;
$$;

revoke all on function public.publish_result_if_ready(uuid, uuid) from public;

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

  -- A member may change their answer while the request is open.
  insert into public.meeting_close_request_answers (request_id, answered_by, answer, reason)
  values (p_request_id, v_profile_id, p_answer, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (request_id, answered_by)
  do update set answer = excluded.answer, reason = excluded.reason, answered_at = now();

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_request_answered', v_profile_id, 'meeting_close_request', p_request_id,
    jsonb_build_object('meeting_id', v_request.meeting_id, 'answer', p_answer,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  v_status := public.evaluate_close_request(p_request_id);

  return jsonb_build_object('request_id', p_request_id, 'status', v_status);
end;
$$;

revoke all on function public.answer_close_request(uuid, text, text) from public;
grant execute on function public.answer_close_request(uuid, text, text) to authenticated;

create or replace function public.request_result_correction(
  p_result_snapshot_id uuid,
  p_category text,
  p_reason text,
  p_legal_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting_id uuid;
  v_level text;
  v_request_id uuid;
  v_admin uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can request a correction.' using errcode = 'P0001';
  end if;

  if p_category not in ('wording', 'room_data', 'voting_rights', 'paper_ballot', 'pass_rule', 'other') then
    raise exception 'RESULT_INVALID_CATEGORY: Choose what needs correcting.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Describe what is wrong.' using errcode = 'P0001';
  end if;

  v_level := public.correction_default_level(p_category);

  if v_level = 'high' and btrim(coalesce(p_legal_reference, '')) = '' then
    raise exception 'RESULT_REFERENCE_REQUIRED: Give the legal or by-law reference.' using errcode = 'P0001';
  end if;

  select s.meeting_id into v_meeting_id
  from public.result_snapshots s
  where s.id = p_result_snapshot_id
    and not exists (select 1 from public.result_publications p where p.meeting_id = s.meeting_id)
    and s.id = (select s2.id from public.result_snapshots s2 where s2.meeting_id = s.meeting_id
                order by s2.generated_at desc limit 1);

  if v_meeting_id is null then
    raise exception 'RESULT_NOT_PENDING: Only the latest unpublished result can be corrected.' using errcode = 'P0001';
  end if;

  -- One open request per result at a time, whoever asked; a new one can be
  -- made once the admin has answered. The lock keeps two requests sent at
  -- the same moment from both passing.
  perform 1 from public.meetings where id = v_meeting_id for update;

  if exists (select 1 from public.result_correction_requests where meeting_id = v_meeting_id and status = 'open') then
    raise exception 'RESULT_CORRECTION_OPEN: A correction request for this result is waiting for the admin.' using errcode = 'P0001';
  end if;

  -- A member who approved this result has said the numbers are correct.
  if exists (
    select 1 from public.committee_approvals
    where result_snapshot_id = p_result_snapshot_id and approved_by = v_profile_id
  ) then
    raise exception 'RESULT_APPROVED_ALREADY: You approved this result, so you cannot request a correction.' using errcode = 'P0001';
  end if;

  insert into public.result_correction_requests
    (meeting_id, result_snapshot_id, requested_by, category, level, reason, legal_reference)
  values (v_meeting_id, p_result_snapshot_id, v_profile_id, p_category, v_level, btrim(p_reason),
    nullif(btrim(coalesce(p_legal_reference, '')), ''))
  returning id into v_request_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result.correction_requested', v_profile_id, 'result_correction_request', v_request_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'result_snapshot_id', p_result_snapshot_id,
      'category', p_category, 'level', v_level));

  for v_admin in select profile_id from public.app_roles where role = 'admin' loop
    perform public.queue_staff_email(v_admin, 'result_correction:' || v_meeting_id);
  end loop;

  return jsonb_build_object('request_id', v_request_id, 'level', v_level);
end;
$$;

revoke all on function public.request_result_correction(uuid, text, text, text) from public;
grant execute on function public.request_result_correction(uuid, text, text, text) to authenticated;

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
  v_held boolean := false;
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
    -- Publishing waits while a correction request is open (0034); it then
    -- happens when the admin answers "No change needed".
    v_published := public.publish_result_if_ready(p_result_snapshot_id, v_approver_id);
    v_held := not v_published;
  end if;

  return jsonb_build_object('approvals', v_count, 'required', v_required, 'published', v_published, 'held', v_held);
end;
$$;

drop function public.answer_correction_request(uuid, text, text);

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
     and (select count(*) from public.committee_approvals where result_snapshot_id = v_latest)
         >= public.result_required_approvals(v_request.meeting_id) then
    v_published := public.publish_result_if_ready(v_latest, v_profile_id);
  end if;

  return jsonb_build_object('status', p_status, 'published', v_published, 'result_snapshot_id', v_latest);
end;
$$;

revoke all on function public.answer_correction_request(uuid, text, text) from public;
grant execute on function public.answer_correction_request(uuid, text, text) to authenticated;

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
    'members', public.committee_people(v_members),
    'open_meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'title_en', m.title_en,
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

revoke all on function public.committee_overview() from public;
grant execute on function public.committee_overview() to authenticated;
