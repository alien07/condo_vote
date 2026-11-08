-- Database tests for multiple choice and the default Abstain choice (D017).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set voter    '''00000000-0000-4000-8000-0000000000e1'''
\set meeting  '''10000000-0000-4000-8000-0000000000e1'''
\set room     '''40000000-0000-4000-8000-0000000000e1'''
\set q_multi  '''20000000-0000-4000-8000-0000000000e1'''

insert into auth.users (id, email) values (:voter, 'voter.e@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status)
values (:voter, :voter, 'Voter E', 'voter.e@example.test', 'owner', 'approved');
insert into public.rooms (id, room_number, ownership_percent) values (:room, 'T-E1', 10);
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:meeting, 'Choice test meeting', 'published', now() - interval '1 hour', now() + interval '1 hour');
insert into public.meeting_questions (id, meeting_id, question_text, question_type, required, max_choices, display_order)
values (:q_multi, :meeting, 'Pick projects', 'multiple_choice', true, 2, 1);
insert into public.meeting_choices (question_id, choice_text, display_order)
select :q_multi, 'Project ' || n, n from generate_series(1, 3) as n;
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
values (:meeting, :room, :voter, 'owner', 10, 'owner_master');

select is(
  (select count(*)::int from public.meeting_choices where question_id = :q_multi and is_abstain),
  1, 'a new question gets one Abstain choice');

select throws_ok(
  format($q$insert into public.meeting_choices (question_id, choice_text, display_order, is_abstain) values (%L, 'Abstain 2', 5, true)$q$, :q_multi),
  '23505', null, 'a question cannot have two Abstain choices');

select set_config('request.jwt.claims', json_build_object('sub', :voter, 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (public.submit_ballot(:meeting, :room, jsonb_build_array(jsonb_build_object(
    'question_id', :q_multi,
    'choice_ids', (select jsonb_agg(id) from (select id from public.meeting_choices where question_id = :q_multi and not is_abstain order by display_order limit 2) c)
  )))->>'version_number')::int,
  1, 'multiple choice accepts two choices');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, :room, jsonb_build_array(jsonb_build_object(
    'question_id', :q_multi,
    'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_multi and not is_abstain)))),
  'VOTE_INVALID_ANSWERS%at most 2%', 'max_choices limits multiple choice');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, :room, jsonb_build_array(jsonb_build_object(
    'question_id', :q_multi,
    'choice_ids', (select jsonb_agg(id) from (select id from public.meeting_choices where question_id = :q_multi order by is_abstain desc, display_order limit 2) c)))),
  'VOTE_INVALID_ANSWERS%Abstain%', 'Abstain cannot be combined with other choices');

select is(
  (public.submit_ballot(:meeting, :room, jsonb_build_array(jsonb_build_object(
    'question_id', :q_multi,
    'choice_ids', (select jsonb_agg(id) from public.meeting_choices where question_id = :q_multi and is_abstain)
  )))->>'version_number')::int,
  2, 'Abstain alone is accepted');

reset role;

select is(
  (select count(*)::int from public.ballot_answers a join public.ballots b on b.id = a.ballot_id where b.meeting_id = :meeting),
  1, 'answers hold one row per selected choice');

select * from finish();
rollback;
