-- Official result record (document 1) and owner summary (document 2).
--
-- * Two voting phases per meeting: an optional advance window that ends
--   before the meeting day, and the meeting-day window (starts_at..ends_at).
-- * Meeting record fields the official record needs: notice date, first or
--   reconvened meeting, identity method, recording and traffic log
--   references, and voting incidents.
-- * Record settings per juristic person: who signs the record, and how many
--   days the regulations give to notify owners (lawyer to confirm, so they
--   are settings rather than fixed rules).
-- * SHA-256 of every result snapshot, so printed documents can be checked
--   against the stored result.

-- Meetings ---------------------------------------------------------------------
alter table public.meetings
  add column advance_starts_at timestamptz,
  add column advance_ends_at timestamptz,
  add column notice_sent_at timestamptz,
  add column meeting_round text not null default 'first',
  add column identity_method text,
  add column recording_reference text,
  add column traffic_log_reference text,
  add constraint meetings_meeting_round_check
    check (meeting_round in ('first', 'reconvened')),
  add constraint meetings_advance_window_check check (
    (advance_starts_at is null and advance_ends_at is null)
    or (
      advance_starts_at is not null
      and advance_ends_at is not null
      and advance_starts_at < advance_ends_at
      and advance_ends_at <= starts_at
    )
  );

comment on column public.meetings.advance_starts_at is
  'Optional advance voting window before the meeting day. Ends at or before starts_at.';
comment on column public.meetings.meeting_round is
  'first, or reconvened when the first meeting had no quorum (Condominium Act s.43).';

-- Record settings --------------------------------------------------------------
alter table public.condo_profiles
  add column record_signatories text[] not null default array['chairperson', 'manager'],
  add column result_notice_days integer,
  add constraint condo_profiles_record_signatories_check check (
    record_signatories <@ array['chairperson', 'manager', 'minutes_taker', 'committee_member']::text[]
    and cardinality(record_signatories) between 1 and 4
  ),
  add constraint condo_profiles_result_notice_days_check
    check (result_notice_days is null or result_notice_days between 1 and 90);

-- Incidents during voting (DE e-meeting standard, clause 14) ----------------------
create table public.meeting_incidents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  description text not null check (length(trim(description)) > 0),
  action_taken text,
  created_by uuid references public.profiles(id) default public.current_profile_id(),
  created_at timestamptz not null default now(),
  constraint meeting_incidents_time_check check (ended_at is null or ended_at >= started_at)
);

create index meeting_incidents_meeting_id_idx on public.meeting_incidents(meeting_id);

alter table public.meeting_incidents enable row level security;

create policy "meeting_incidents_admin_or_committee_select"
on public.meeting_incidents for select to authenticated
using (public.can_approve_as_committee());

create policy "meeting_incidents_admin_insert"
on public.meeting_incidents for insert to authenticated
with check (public.has_app_role('admin'));

create policy "meeting_incidents_admin_update"
on public.meeting_incidents for update to authenticated
using (public.has_app_role('admin')) with check (public.has_app_role('admin'));

create policy "meeting_incidents_admin_delete"
on public.meeting_incidents for delete to authenticated
using (public.has_app_role('admin'));

-- Committee members read approvals for the official record.
create policy "committee_approvals_committee_select"
on public.committee_approvals for select to authenticated
using (public.can_approve_as_committee());

-- Snapshot hash ----------------------------------------------------------------
alter table public.result_snapshots add column payload_sha256 text;

comment on column public.result_snapshots.payload_sha256 is
  'SHA-256 (hex) of payload_json::text, set on insert. Printed on result documents.';

create or replace function public.set_result_snapshot_sha256()
returns trigger
language plpgsql
as $$
begin
  new.payload_sha256 := encode(sha256(convert_to(new.payload_json::text, 'UTF8')), 'hex');
  return new;
end;
$$;

create trigger result_snapshots_set_sha256
before insert on public.result_snapshots
for each row execute function public.set_result_snapshot_sha256();

-- Backfill existing snapshots. Approved ones are otherwise immutable.
alter table public.result_snapshots disable trigger result_snapshots_prevent_change_after_approval;
update public.result_snapshots
set payload_sha256 = encode(sha256(convert_to(payload_json::text, 'UTF8')), 'hex')
where payload_sha256 is null;
alter table public.result_snapshots enable trigger result_snapshots_prevent_change_after_approval;

-- Voting core: accept ballots in either phase --------------------------------------
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

  select id, status, starts_at, ends_at, advance_starts_at, advance_ends_at into v_meeting
  from public.meetings where id = p_meeting_id;

  -- Two voting phases: an optional advance window before the meeting day,
  -- and the meeting-day window (starts_at to ends_at).
  if v_meeting.status <> 'published'
    or not (
      (v_now >= v_meeting.starts_at and v_now <= v_meeting.ends_at)
      or (
        v_meeting.advance_starts_at is not null
        and v_now >= v_meeting.advance_starts_at
        and v_now <= v_meeting.advance_ends_at
      )
    ) then
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
