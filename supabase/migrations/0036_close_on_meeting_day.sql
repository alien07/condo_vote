-- Close-early requests only close voting on the meeting day (review
-- 2026-11-14, user chose option b).
--
-- A request can be sent during advance voting, but then it must name a close
-- time within meeting-day voting; "as soon as approved" is allowed only once
-- meeting-day voting has started. This keeps advance voting from ending the
-- meeting before its day. committee_overview() also returns starts_at, so
-- the form can offer only allowed times. Other parts unchanged from 0030 and
-- 0034.

create or replace function public.propose_close_voting(
  p_meeting_id uuid,
  p_reason text,
  p_close_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting record;
  v_request_id uuid;
  v_status text;
  v_member uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can propose closing voting.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for closing early.' using errcode = 'P0001';
  end if;

  select id, status, starts_at, ends_at into v_meeting
  from public.meetings where id = p_meeting_id for update;

  if v_meeting.id is null or v_meeting.status <> 'published' or now() > v_meeting.ends_at then
    raise exception 'RESULT_VOTING_NOT_OPEN: Voting is not open for this meeting.' using errcode = 'P0001';
  end if;

  -- Voting closes only on the meeting day (review 2026-11-14, option b):
  -- during advance voting or the pause before the meeting day, a request
  -- must name a close time within meeting-day voting.
  if p_close_at is null and now() < v_meeting.starts_at then
    raise exception 'RESULT_CLOSE_BEFORE_MEETING_DAY: Before the meeting day, choose a close time on the meeting day.' using errcode = 'P0001';
  end if;

  if p_close_at is not null
     and (p_close_at <= now() or p_close_at >= v_meeting.ends_at or p_close_at <= v_meeting.starts_at) then
    raise exception 'RESULT_CLOSE_TIME: The close time must be in the future, on the meeting day, and before the set end time.' using errcode = 'P0001';
  end if;

  -- A request whose meeting has ended does not block a new one.
  update public.meeting_close_requests r
  set status = 'lapsed', ended_at = now()
  where r.meeting_id = p_meeting_id and r.status = 'open'
    and exists (select 1 from public.meetings m where m.id = r.meeting_id and (m.status <> 'published' or now() > m.ends_at));

  if exists (select 1 from public.meeting_close_requests where meeting_id = p_meeting_id and status = 'open') then
    raise exception 'RESULT_REQUEST_OPEN: This meeting already has an open request to close early.' using errcode = 'P0001';
  end if;

  insert into public.meeting_close_requests (meeting_id, proposed_by, reason, close_at, original_ends_at)
  values (p_meeting_id, v_profile_id, btrim(p_reason), p_close_at, v_meeting.ends_at)
  returning id into v_request_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_requested', v_profile_id, 'meeting_close_request', v_request_id,
    jsonb_build_object('meeting_id', p_meeting_id, 'reason', btrim(p_reason), 'close_at', p_close_at));

  -- The proposal counts as the proposer's approval when they are a member.
  if v_profile_id in (select public.active_committee_profile_ids()) then
    insert into public.meeting_close_request_answers (request_id, answered_by, answer)
    values (v_request_id, v_profile_id, 'approve');
  end if;

  for v_member in select public.active_committee_profile_ids() loop
    if v_member <> v_profile_id then
      perform public.queue_staff_email(v_member, 'close_request:' || p_meeting_id);
    end if;
  end loop;

  v_status := public.evaluate_close_request(v_request_id);

  return jsonb_build_object('request_id', v_request_id, 'status', v_status);
end;
$$;

revoke all on function public.propose_close_voting(uuid, text, timestamptz) from public;
grant execute on function public.propose_close_voting(uuid, text, timestamptz) to authenticated;

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
