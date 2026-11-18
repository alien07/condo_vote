-- Paper ballots only for a meeting that takes them (2026-11-19): published,
-- during voting or after it ends, until the result is generated (which
-- closes the meeting). A draft has no voter list yet, and a closed or
-- archived meeting already has its result, so a ballot there would not
-- match it. Same rule as takesPaperBallots in features/admin/meeting-pickers.ts.
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

  if not exists (
    select 1 from public.meetings m where m.id = p_meeting_id and m.status = 'published'
  ) then
    raise exception 'VOTE_CLOSED: Paper ballots can only be entered for a published meeting whose result has not been generated.' using errcode = 'P0001';
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
