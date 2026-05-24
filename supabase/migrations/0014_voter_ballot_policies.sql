-- Voter-facing read/write policies for eligible meetings and ballots.

create policy "meetings_voter_select_eligible"
on public.meetings
for select
to authenticated
using (
  status in ('published', 'closed')
  and exists (
    select 1
    from public.eligible_voters_snapshot eligible
    where eligible.meeting_id = meetings.id
      and eligible.profile_id = public.current_profile_id()
  )
);

create policy "rooms_voter_select_eligible"
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.eligible_voters_snapshot eligible
    where eligible.room_id = rooms.id
      and eligible.profile_id = public.current_profile_id()
  )
);

create policy "eligible_voters_snapshot_voter_select_own"
on public.eligible_voters_snapshot
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy "meeting_questions_voter_select_eligible"
on public.meeting_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.eligible_voters_snapshot eligible
    join public.meetings meeting on meeting.id = eligible.meeting_id
    where eligible.meeting_id = meeting_questions.meeting_id
      and eligible.profile_id = public.current_profile_id()
      and meeting.status in ('published', 'closed')
  )
);

create policy "meeting_choices_voter_select_eligible"
on public.meeting_choices
for select
to authenticated
using (
  exists (
    select 1
    from public.meeting_questions question
    join public.eligible_voters_snapshot eligible
      on eligible.meeting_id = question.meeting_id
    join public.meetings meeting on meeting.id = eligible.meeting_id
    where question.id = meeting_choices.question_id
      and eligible.profile_id = public.current_profile_id()
      and meeting.status in ('published', 'closed')
  )
);

create policy "ballots_voter_select_own"
on public.ballots
for select
to authenticated
using (
  voter_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.eligible_voters_snapshot eligible
    where eligible.meeting_id = ballots.meeting_id
      and eligible.room_id = ballots.room_id
      and eligible.profile_id = public.current_profile_id()
  )
);

create policy "ballots_voter_insert_own"
on public.ballots
for insert
to authenticated
with check (
  voter_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.eligible_voters_snapshot eligible
    join public.meetings meeting on meeting.id = eligible.meeting_id
    where eligible.meeting_id = ballots.meeting_id
      and eligible.room_id = ballots.room_id
      and eligible.profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
);

create policy "ballots_voter_update_own"
on public.ballots
for update
to authenticated
using (
  voter_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.eligible_voters_snapshot eligible
    join public.meetings meeting on meeting.id = eligible.meeting_id
    where eligible.meeting_id = ballots.meeting_id
      and eligible.room_id = ballots.room_id
      and eligible.profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
)
with check (
  voter_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.eligible_voters_snapshot eligible
    join public.meetings meeting on meeting.id = eligible.meeting_id
    where eligible.meeting_id = ballots.meeting_id
      and eligible.room_id = ballots.room_id
      and eligible.profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
);

create policy "ballot_answers_voter_select_own"
on public.ballot_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.ballots ballot
    where ballot.id = ballot_answers.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
  )
);

create policy "ballot_answers_voter_insert_own"
on public.ballot_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_answers.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
);

create policy "ballot_answers_voter_update_own"
on public.ballot_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_answers.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
)
with check (
  exists (
    select 1
    from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_answers.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
);

create policy "ballot_versions_voter_select_own"
on public.ballot_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.ballots ballot
    where ballot.id = ballot_versions.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
  )
);

create policy "ballot_versions_voter_insert_own"
on public.ballot_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_versions.ballot_id
      and ballot.voter_profile_id = public.current_profile_id()
      and meeting.status = 'published'
      and now() between meeting.starts_at and meeting.ends_at
  )
);
