-- Voting core service (D010), one voting right per room (D011),
-- and proxy limit (D012).
--
-- Every ballot write goes through one of these functions. Each call runs in a
-- single transaction, so a ballot, its answers, its version, and its audit
-- entry are written together or not at all.
--
-- Errors are raised as 'VOTE_<CODE>: <message>' with errcode P0001.
-- See docs/error_code.md.

-- Answers can hold several choices per question (multiple choice, D017).
alter table public.ballot_answers
  drop constraint ballot_answers_ballot_id_question_id_key,
  add constraint ballot_answers_ballot_question_choice_key
    unique (ballot_id, question_id, choice_id);

alter table public.manual_ballot_answers
  drop constraint manual_ballot_answers_manual_ballot_id_question_id_key,
  add constraint manual_ballot_answers_ballot_question_choice_key
    unique (manual_ballot_id, question_id, choice_id);

-- Validates answers for a meeting and returns one row per selected choice.
-- p_answers: [{"question_id": uuid, "choice_ids": [uuid, ...]}, ...]
create or replace function public.vote_normalize_answers(
  p_meeting_id uuid,
  p_answers jsonb
)
returns table (question_id uuid, choice_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_question record;
  v_selected uuid[];
  v_count integer;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'VOTE_INVALID_ANSWERS: Answers must be a list.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) as item
    where not exists (
      select 1 from public.meeting_questions q
      where q.meeting_id = p_meeting_id
        and q.id::text = item->>'question_id'
    )
  ) then
    raise exception 'VOTE_INVALID_ANSWERS: An answer does not belong to this meeting.' using errcode = 'P0001';
  end if;

  for v_question in
    select q.id, q.question_text, q.question_type, q.required
    from public.meeting_questions q
    where q.meeting_id = p_meeting_id
    order by q.display_order, q.created_at
  loop
    select coalesce(array_agg(distinct choice::uuid), '{}')
    into v_selected
    from jsonb_array_elements(p_answers) as item,
      jsonb_array_elements_text(coalesce(item->'choice_ids', '[]'::jsonb)) as choice
    where item->>'question_id' = v_question.id::text;

    v_count := coalesce(array_length(v_selected, 1), 0);

    if v_count = 0 and v_question.required then
      raise exception 'VOTE_INVALID_ANSWERS: % is required.', v_question.question_text using errcode = 'P0001';
    end if;

    if v_question.question_type = 'single_choice' and v_count > 1 then
      raise exception 'VOTE_INVALID_ANSWERS: % allows one choice.', v_question.question_text using errcode = 'P0001';
    end if;

    if exists (
      select 1 from unnest(v_selected) as selected(id)
      where not exists (
        select 1 from public.meeting_choices c
        where c.id = selected.id and c.question_id = v_question.id
      )
    ) then
      raise exception 'VOTE_INVALID_ANSWERS: A selected choice does not belong to %.', v_question.question_text using errcode = 'P0001';
    end if;

    return query select v_question.id, selected.id from unnest(v_selected) as selected(id);
  end loop;
end;
$$;

revoke all on function public.vote_normalize_answers(uuid, jsonb) from public;

-- Online ballot submit or update by the eligible voter (D010, D011).
create or replace function public.submit_ballot(
  p_meeting_id uuid,
  p_room_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting record;
  v_ballot record;
  v_version integer;
  v_now timestamptz := now();
  v_answers jsonb;
  v_existing boolean;
begin
  if v_profile_id is null then
    raise exception 'VOTE_NOT_SIGNED_IN: Sign in to vote.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.eligible_voters_snapshot s
    where s.meeting_id = p_meeting_id
      and s.room_id = p_room_id
      and s.profile_id = v_profile_id
  ) then
    raise exception 'VOTE_NOT_ELIGIBLE: You are not eligible to vote for this room and meeting.' using errcode = 'P0001';
  end if;

  select id, status, starts_at, ends_at into v_meeting
  from public.meetings where id = p_meeting_id;

  if v_meeting.status <> 'published'
    or v_now < v_meeting.starts_at
    or v_now > v_meeting.ends_at then
    raise exception 'VOTE_CLOSED: Voting is not open for this meeting.' using errcode = 'P0001';
  end if;

  -- One voting right per room: lock the room's ballot row while we write.
  select id, voter_profile_id, version_number into v_ballot
  from public.ballots
  where meeting_id = p_meeting_id and room_id = p_room_id
  for update;
  v_existing := found;

  if v_existing and v_ballot.voter_profile_id <> v_profile_id then
    raise exception 'VOTE_ROOM_LOCKED: Another voter already submitted the ballot for this room.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('question_id', a.question_id, 'choice_id', a.choice_id)), '[]'::jsonb)
  into v_answers
  from public.vote_normalize_answers(p_meeting_id, p_answers) as a;

  if v_existing then
    v_version := v_ballot.version_number + 1;
    update public.ballots
    set status = 'submitted', submitted_at = v_now, version_number = v_version
    where id = v_ballot.id;
  else
    v_version := 1;
    insert into public.ballots (meeting_id, room_id, voter_profile_id, status, submitted_at, version_number)
    values (p_meeting_id, p_room_id, v_profile_id, 'submitted', v_now, v_version)
    returning id, voter_profile_id, version_number into v_ballot;
  end if;

  delete from public.ballot_answers where ballot_id = v_ballot.id;
  insert into public.ballot_answers (ballot_id, question_id, choice_id)
  select v_ballot.id, (item->>'question_id')::uuid, (item->>'choice_id')::uuid
  from jsonb_array_elements(v_answers) as item;

  insert into public.ballot_versions (ballot_id, version_number, payload_json)
  values (
    v_ballot.id,
    v_version,
    jsonb_build_object(
      'meeting_id', p_meeting_id,
      'room_id', p_room_id,
      'submitted_at', v_now,
      'answers', v_answers
    )
  );

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values (
    case when v_version = 1 then 'ballot.submitted' else 'ballot.updated' end,
    v_profile_id,
    'ballot',
    v_ballot.id,
    jsonb_build_object('meeting_id', p_meeting_id, 'room_id', p_room_id, 'version_number', v_version)
  );

  return jsonb_build_object('ballot_id', v_ballot.id, 'version_number', v_version);
end;
$$;

revoke all on function public.submit_ballot(uuid, uuid, jsonb) from public;
grant execute on function public.submit_ballot(uuid, uuid, jsonb) to authenticated;

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
  if not public.has_app_role('admin') then
    raise exception 'VOTE_FORBIDDEN: Only admins can import manual ballots.' using errcode = 'P0001';
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

revoke all on function public.submit_manual_ballot(uuid, uuid, uuid, text, text, jsonb) from public;
grant execute on function public.submit_manual_ballot(uuid, uuid, uuid, text, text, jsonb) to authenticated;

-- Admin choice between the online and manual ballot of one room (D010).
create or replace function public.resolve_vote_source_conflict(
  p_meeting_id uuid,
  p_room_id uuid,
  p_online_ballot_id uuid,
  p_manual_ballot_id uuid,
  p_chosen_source text,
  p_conflict_remark text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolver_id uuid := public.current_profile_id();
  v_resolution_id uuid;
  v_chosen_ballot_id uuid;
begin
  if not public.has_app_role('admin') then
    raise exception 'VOTE_FORBIDDEN: Only admins can resolve vote conflicts.' using errcode = 'P0001';
  end if;

  if p_chosen_source not in ('online', 'manual') then
    raise exception 'VOTE_INVALID_CONFLICT: Choose the online or manual source.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.ballots
    where id = p_online_ballot_id and meeting_id = p_meeting_id and room_id = p_room_id
  ) or not exists (
    select 1 from public.manual_ballots
    where id = p_manual_ballot_id and meeting_id = p_meeting_id and room_id = p_room_id
  ) then
    raise exception 'VOTE_INVALID_CONFLICT: The ballots do not belong to this meeting and room.' using errcode = 'P0001';
  end if;

  v_chosen_ballot_id := case when p_chosen_source = 'online' then p_online_ballot_id else p_manual_ballot_id end;

  insert into public.vote_source_resolutions (
    meeting_id, room_id, online_ballot_id, manual_ballot_id, chosen_source,
    chosen_ballot_id, conflict_remark, resolved_by, resolved_at
  )
  values (
    p_meeting_id, p_room_id, p_online_ballot_id, p_manual_ballot_id, p_chosen_source,
    v_chosen_ballot_id, nullif(btrim(coalesce(p_conflict_remark, '')), ''), v_resolver_id, now()
  )
  on conflict (meeting_id, room_id) do update set
    online_ballot_id = excluded.online_ballot_id,
    manual_ballot_id = excluded.manual_ballot_id,
    chosen_source = excluded.chosen_source,
    chosen_ballot_id = excluded.chosen_ballot_id,
    conflict_remark = excluded.conflict_remark,
    resolved_by = excluded.resolved_by,
    resolved_at = excluded.resolved_at
  returning id into v_resolution_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values (
    'vote_source_conflict.resolved',
    v_resolver_id,
    'vote_source_resolution',
    v_resolution_id,
    jsonb_build_object(
      'chosen_ballot_id', v_chosen_ballot_id,
      'chosen_source', p_chosen_source,
      'meeting_id', p_meeting_id,
      'room_id', p_room_id
    )
  );

  return jsonb_build_object('resolution_id', v_resolution_id);
end;
$$;

revoke all on function public.resolve_vote_source_conflict(uuid, uuid, uuid, uuid, text, text) from public;
grant execute on function public.resolve_vote_source_conflict(uuid, uuid, uuid, uuid, text, text) to authenticated;

-- D012: one proxy holds at most three rooms per meeting.
create or replace function public.enforce_proxy_room_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'approved') and (
    select count(*)
    from public.proxy_authorizations p
    where p.meeting_id = new.meeting_id
      and p.proxy_profile_id = new.proxy_profile_id
      and p.status in ('pending', 'approved')
      and p.id <> new.id
  ) >= 3 then
    raise exception 'VOTE_PROXY_LIMIT: One proxy can hold at most three rooms per meeting.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger proxy_authorizations_room_limit
before insert or update of status, meeting_id, proxy_profile_id
on public.proxy_authorizations
for each row execute function public.enforce_proxy_room_limit();

-- D011: after a meeting is published, approving or revoking a proxy updates
-- the room's voter in eligible_voters_snapshot. It is refused once the room
-- has an online ballot, because the room's voting right is already used.
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
    -- Same owner rule as publishing: current owner link, approved owner profile.
    select p.id into v_owner_profile_id
    from public.room_owners ro
    join public.owners o on o.id = ro.owner_id
    join public.profiles p on lower(p.email) = lower(o.email)
    where ro.room_id = new.room_id
      and ro.ends_at is null
      and p.approval_status = 'approved'
      and p.default_status = 'owner'
    limit 1;

    if v_owner_profile_id is not null then
      insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
      values (new.meeting_id, new.room_id, v_owner_profile_id, 'owner', v_ownership, 'owner_master');
    end if;
  end if;

  return new;
end;
$$;

create trigger proxy_authorizations_sync_published_snapshot
after insert or update of status
on public.proxy_authorizations
for each row execute function public.sync_published_proxy_snapshot();
