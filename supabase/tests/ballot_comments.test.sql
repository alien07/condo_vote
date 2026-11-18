-- Optional voter comments per agenda item (0040).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

\set voter    '''00000000-0000-4000-8000-0000000000c1'''
\set other    '''00000000-0000-4000-8000-0000000000c2'''
\set admin    '''00000000-0000-4000-8000-0000000000c3'''
\set meeting  '''10000000-0000-4000-8000-0000000000c1'''
\set room     '''40000000-0000-4000-8000-0000000000c1'''
\set q_open   '''20000000-0000-4000-8000-0000000000c1'''
\set q_shut   '''20000000-0000-4000-8000-0000000000c2'''

insert into auth.users (id, email) values
  (:voter, 'voter.c@example.test'), (:other, 'other.c@example.test'), (:admin, 'admin.c@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:voter, :voter, 'Voter C', 'voter.c@example.test', 'owner', 'approved'),
  (:other, :other, 'Other C', 'other.c@example.test', 'owner', 'approved'),
  (:admin, :admin, 'Admin C', 'admin.c@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin, 'admin');
insert into public.rooms (id, room_number, ownership_percent) values (:room, 'T-C1', 10);
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:meeting, 'Comment meeting', 'published', now() - interval '1 hour', now() + interval '1 hour');
insert into public.meeting_questions (id, meeting_id, question_text, required, display_order, allow_comment) values
  (:q_open, :meeting, 'Approve budget', true, 1, true),
  (:q_shut, :meeting, 'Approve auditor', true, 2, false);
insert into public.meeting_choices (question_id, choice_text, display_order) values
  (:q_open, 'Agree', 1), (:q_shut, 'Agree', 1);
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
values (:meeting, :room, :voter, 'owner', 10, 'owner_master');

create temp table answers as
select jsonb_build_array(
  jsonb_build_object('question_id', :q_open,
    'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_open and not is_abstain),
    'comment', '  Please show the quotes.  '),
  jsonb_build_object('question_id', :q_shut,
    'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_shut and not is_abstain),
    'comment', 'Not allowed here')) as payload;
grant select on answers to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', :voter, 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  format($q$select public.submit_ballot(%L, %L, (select payload from answers))$q$, :meeting, :room),
  'a ballot with comments is accepted');

select is(
  (select array_agg(comment) from public.ballot_comments),
  array['Please show the quotes.'],
  'only the agenda item that allows comments keeps one, trimmed; the voter reads it back');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, :room, jsonb_build_array(
    jsonb_build_object('question_id', :q_open,
      'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_open and not is_abstain),
      'comment', repeat('x', 501)),
    jsonb_build_object('question_id', :q_shut,
      'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_shut and not is_abstain)))),
  'VOTE_INVALID_ANSWERS%500%', 'a comment over 500 characters is refused');

select lives_ok(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, :room, jsonb_build_array(
    jsonb_build_object('question_id', :q_open,
      'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_open and not is_abstain),
      'comment', 'Changed my mind on wording'),
    jsonb_build_object('question_id', :q_shut,
      'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_shut and not is_abstain)))),
  'voting again is accepted');

select is(
  (select array_agg(comment) from public.ballot_comments),
  array['Changed my mind on wording'],
  'voting again replaces the comment');

select throws_like(
  format($q$select * from public.meeting_comments(%L)$q$, :meeting),
  'VOTE_FORBIDDEN%', 'an owner cannot read the meeting''s comments');

select set_config('request.jwt.claims', json_build_object('sub', :other, 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.ballot_comments), 0, 'another owner cannot read someone''s comment');

select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
select is(
  (select comment || ' / ' || array_to_string(choice_texts, ',') from public.meeting_comments(:meeting)),
  'Changed my mind on wording / Agree',
  'the office reads the comment with the chosen answer');

select is(
  (select array_agg(p.parameter_name::text order by p.ordinal_position) from information_schema.routines r
   join information_schema.parameters p using (specific_schema, specific_name)
   where r.routine_name = 'meeting_comments' and p.parameter_mode = 'OUT'),
  array['question_id', 'choice_texts', 'comment'],
  'meeting_comments returns no room, voter or time');

select * from finish();
rollback;
