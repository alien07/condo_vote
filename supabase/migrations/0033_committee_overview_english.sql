-- English meeting titles on the Committee page (D020, item 6b).
--
-- committee_overview() returned only the Thai title, so the Committee page
-- showed Thai titles in English. It now also returns title_en; the page
-- shows it when the reader uses English and it is filled in. Everything
-- else in the function is unchanged from 0030.

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
