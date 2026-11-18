-- Optional voter comments per agenda item (2026-11-18).
--
-- The admin turns comments on per agenda item (draft only, 0039). A voter
-- may add a comment of up to 500 characters with whatever they chose. The
-- office and the committee read the comments without the room or the voter,
-- for open and secret ballots alike; owners do not see them and they are
-- not in the result PDF.

alter table public.meeting_questions
  add column allow_comment boolean not null default false;

create table public.ballot_comments (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id),
  question_id uuid not null references public.meeting_questions(id) on delete cascade,
  comment text not null check (char_length(btrim(comment)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (ballot_id, question_id)
);

create index ballot_comments_meeting_question_idx
  on public.ballot_comments (meeting_id, question_id);

alter table public.ballot_comments enable row level security;

-- The voter sees their own comment again on the ballot. No other policy:
-- office and committee read through meeting_comments(), which leaves out
-- the ballot, room and voter.
create policy "ballot_comments_own_select"
on public.ballot_comments
for select
to authenticated
using (
  exists (
    select 1 from public.ballots b
    where b.id = ballot_comments.ballot_id
      and b.voter_profile_id = public.current_profile_id()
  )
);

-- Comments of one meeting for the office (admin, staff) and the committee:
-- agenda item, what the voter chose, and the text. No room, voter or time;
-- the order is fixed but not by time, so it cannot be matched to ballots.
create or replace function public.meeting_comments(p_meeting_id uuid)
returns table (question_id uuid, choice_texts text[], comment text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_office_staff() or public.has_app_role('committee')) then
    raise exception 'VOTE_FORBIDDEN: Only the office and the committee can read comments.' using errcode = 'P0001';
  end if;

  return query
  select c.question_id,
    coalesce((
      select array_agg(ch.choice_text order by ch.display_order)
      from public.ballot_answers a
      join public.meeting_choices ch on ch.id = a.choice_id
      where a.ballot_id = c.ballot_id and a.question_id = c.question_id
    ), array[]::text[]),
    c.comment
  from public.ballot_comments c
  where c.meeting_id = p_meeting_id
  order by c.question_id, md5(c.id::text);
end;
$$;

revoke all on function public.meeting_comments(uuid) from public, anon;
grant execute on function public.meeting_comments(uuid) to authenticated;

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

  -- Optional comments (0040): at most 500 characters each.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as item
    where char_length(btrim(coalesce(item->>'comment', ''))) > 500
  ) then
    raise exception 'VOTE_INVALID_ANSWERS: A comment can be at most 500 characters.' using errcode = 'P0001';
  end if;

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

  -- Comments replace the room's earlier ones, only for agenda items that
  -- allow them. They are kept out of ballot_versions and the audit log so
  -- the office and committee read them without the room (0040).
  delete from public.ballot_comments where ballot_id = v_ballot.id;
  insert into public.ballot_comments (ballot_id, meeting_id, question_id, comment)
  select distinct on (q.id) v_ballot.id, p_meeting_id, q.id, btrim(item->>'comment')
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as item
  join public.meeting_questions q
    on q.id::text = item->>'question_id'
   and q.meeting_id = p_meeting_id
   and q.allow_comment
  where nullif(btrim(coalesce(item->>'comment', '')), '') is not null;

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
