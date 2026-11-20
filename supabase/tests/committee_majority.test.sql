-- Database tests for committee majority and the chair's casting vote
-- (req_0011 A, D027): n = max(meeting setting, floor(N/2)+1) among active
-- members; objections with a reason; a tie waits for the chair (vice chair
-- when there is no chair); a high-level correction still needs everyone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

\set admin_x '''00000000-0000-4000-8000-0000000001e0'''
\set c1 '''00000000-0000-4000-8000-0000000001e1'''
\set c2 '''00000000-0000-4000-8000-0000000001e2'''
\set c3 '''00000000-0000-4000-8000-0000000001e3'''
\set c4 '''00000000-0000-4000-8000-0000000001e4'''
\set c5 '''00000000-0000-4000-8000-0000000001e5'''
\set c6 '''00000000-0000-4000-8000-0000000001e6'''
\set m_pass  '''10000000-0000-4000-8000-0000000001e1'''
\set m_fail  '''10000000-0000-4000-8000-0000000001e2'''
\set m_tie   '''10000000-0000-4000-8000-0000000001e3'''
\set m_sep   '''10000000-0000-4000-8000-0000000001e4'''
\set m_high  '''10000000-0000-4000-8000-0000000001e5'''
\set m_nochair '''10000000-0000-4000-8000-0000000001e6'''
\set m_open  '''10000000-0000-4000-8000-0000000001e7'''
\set s_pass  '''50000000-0000-4000-8000-0000000001e1'''
\set s_fail  '''50000000-0000-4000-8000-0000000001e2'''
\set s_tie   '''50000000-0000-4000-8000-0000000001e3'''
\set s_sep   '''50000000-0000-4000-8000-0000000001e4'''
\set s_high  '''50000000-0000-4000-8000-0000000001e5'''
\set s_nochair '''50000000-0000-4000-8000-0000000001e6'''

insert into auth.users (id, email)
select id, 'cm.' || right(id::text, 2) || '@example.test'
from unnest(array[:admin_x, :c1, :c2, :c3, :c4, :c5, :c6]::uuid[]) id;
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status)
select id, id, 'Member ' || right(id::text, 2), 'cm.' || right(id::text, 2) || '@example.test', 'owner', 'approved'
from unnest(array[:admin_x, :c1, :c2, :c3, :c4, :c5, :c6]::uuid[]) id;
insert into public.app_roles (profile_id, role)
select id, 'committee' from unnest(array[:c1, :c2, :c3, :c4, :c5, :c6]::uuid[]) id;
insert into public.app_roles (profile_id, role) values (:admin_x, 'admin');
-- c1 chair, c2 vice chair; c5 and c6 start inactive so N = 4.
insert into public.committee_members (profile_id, full_name, position_code, active) values
  (:c1, 'Member C1', 'chair', true), (:c2, 'Member C2', 'vice_chair', true),
  (:c3, 'Member C3', 'member', true), (:c4, 'Member C4', 'member', true),
  (:c5, 'Member C5', 'member', false), (:c6, 'Member C6', 'member', false);

-- The meeting setting is 1, so the majority decides.
insert into public.meetings (id, title, status, starts_at, ends_at, required_approvals)
select id, 'Majority ' || right(id::text, 2), 'closed', now() - interval '2 hours', now() - interval '1 hour', 1
from unnest(array[:m_pass, :m_fail, :m_tie, :m_sep, :m_high, :m_nochair]::uuid[]) id;
insert into public.meetings (id, title, status, starts_at, ends_at, required_approvals)
values (:m_open, 'Majority open', 'published', now() - interval '1 hour', now() + interval '1 hour', 1);
insert into public.result_snapshots (id, meeting_id, payload_json, generated_by) values
  (:s_pass, :m_pass, '{}', null), (:s_fail, :m_fail, '{}', null), (:s_tie, :m_tie, '{}', null),
  (:s_sep, :m_sep, '{}', :c3), (:s_high, :m_high, '{}', null), (:s_nochair, :m_nochair, '{}', null);
-- A high-level correction answered as fixed by the Manager (not a member).
insert into public.result_correction_requests
  (meeting_id, result_snapshot_id, category, level, legal_reference, reason, requested_by, status, answer, answered_by, answered_at)
values (:m_high, :s_high, 'room_data', 'high', 'Condominium Act section 48', 'Share of a room was wrong', :c4, 'fixed', 'Fixed the share', :admin_x, now());

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.set_active(ids uuid[]) returns void language sql as $$
  update public.committee_members set active = (profile_id = any(ids));
$$;

-- n of N ----------------------------------------------------------------------
select pg_temp.set_active(array[:c1, :c2, :c3]::uuid[]);
select is(public.committee_majority(1), 2, 'N = 3: a majority is 2');
select is(public.committee_majority(5), 5, 'the meeting setting can raise the number');
select pg_temp.set_active(array[:c1, :c2, :c3, :c4, :c5]::uuid[]);
select is(public.committee_majority(1), 3, 'N = 5: a majority is 3');
select pg_temp.set_active(array[:c1, :c2, :c3, :c4, :c5, :c6]::uuid[]);
select is(public.committee_majority(1), 4, 'N = 6: a majority is 4');
select pg_temp.set_active(array[:c1, :c2, :c3, :c4]::uuid[]);
select is(public.committee_majority(1), 3, 'N = 4: a majority is 3');
select is(public.committee_majority(0), 3, 'a setting below the majority does not lower it');

-- Passed by a majority (N = 4, n = 3) -------------------------------------------
set local role authenticated;
select pg_temp.act_as(:c1);
select is(public.approve_result_snapshot(:s_pass, null)->>'status', 'open', '1 of 3: still open');
select pg_temp.act_as(:c2);
select is(public.approve_result_snapshot(:s_pass, null)->>'published', 'false', '2 of 3 does not publish');
select pg_temp.act_as(:c3);
select is(public.approve_result_snapshot(:s_pass, null)->>'published', 'true', '3 of 4 members publish');
reset role;
select is((select approvals_count from public.result_publications where meeting_id = :m_pass), 3,
  'the publication records three approvals');
select is((select committee_members || '/' || required_approvals from public.result_publications where meeting_id = :m_pass),
  '4/3', 'the publication keeps n of N at that moment');

-- Not passed by objections ------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:c1);
select throws_like(format($q$select public.object_result_snapshot(%L, '  ')$q$, :s_fail),
  'RESULT_REASON_REQUIRED%', 'an objection needs a reason');
select is(public.object_result_snapshot(:s_fail, 'Room A-101 share looks wrong')->>'status', 'open',
  'one objection keeps the decision open');
select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :s_fail),
  'RESULT_ALREADY_ANSWERED%', 'an objection cannot become an approval');
select pg_temp.act_as(:c2);
select is(public.object_result_snapshot(:s_fail, 'Same concern')->>'status', 'open', 'two objections: open');
select pg_temp.act_as(:c3);
select is(public.object_result_snapshot(:s_fail, 'Agree with the others')->>'status', 'not_passed',
  'three objections of four: not passed');
select pg_temp.act_as(:c4);
select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :s_fail),
  'RESULT_DECIDED%', 'nobody answers after the decision');
reset role;
select ok(exists (select 1 from public.email_logs where template_key = 'result_not_passed:' || :m_fail),
  'the Manager is emailed that the result did not pass');
select is((select count(*)::int from public.audit_logs
           where action = 'result_snapshot.not_passed' and entity_id = :s_fail), 1,
  'not passed is logged once');
select is((select count(*)::int from public.result_publications where meeting_id = :m_fail), 0,
  'a result that did not pass is not published');
select lives_ok(format($q$insert into public.result_snapshots (meeting_id, payload_json) values (%L, '{}')$q$, :m_fail),
  'a result that did not pass can be generated again');
select throws_like(format($q$insert into public.result_snapshots (meeting_id, payload_json) values (%L, '{}')$q$, :m_pass),
  'Cannot generate result snapshots after%', 'a published result cannot');
select pg_temp.act_as(:admin_x);
set local role authenticated;
select ok(jsonb_array_length(public.result_decisions()) >= 1, 'the Manager reads the decisions');
reset role;

-- A tie and the chair's casting vote --------------------------------------------
set local role authenticated;
select pg_temp.act_as(:c1);
select throws_like(format($q$select public.cast_committee_deciding_vote('result', %L, 'approve')$q$, :s_tie),
  'COMMITTEE_NOT_TIED%', 'no casting vote before a tie');
select public.approve_result_snapshot(:s_tie, null);
select pg_temp.act_as(:c2);
select public.approve_result_snapshot(:s_tie, null);
select pg_temp.act_as(:c3);
select public.object_result_snapshot(:s_tie, 'Disagree');
select pg_temp.act_as(:c4);
select is(public.object_result_snapshot(:s_tie, 'Disagree too')->>'status', 'tie', '2 to 2 of 4 is a tie');
select throws_like(format($q$select public.cast_committee_deciding_vote('result', %L, 'approve')$q$, :s_tie),
  'COMMITTEE_NOT_CHAIR%', 'only the chair casts the deciding vote');
select pg_temp.act_as(:c1);
select is(public.cast_committee_deciding_vote('result', :s_tie, 'approve', 'Chair decides')->>'published', 'true',
  'the chair''s approval publishes the result');
reset role;
select is((select position_code from public.committee_casting_votes where subject_id = :s_tie), 'chair',
  'the casting vote records the chair''s position');
select is((select decided_by_casting_vote from public.result_publications where meeting_id = :m_tie), true,
  'the publication says the chair decided');

-- Separation: whoever generated the result does not answer ------------------------
set local role authenticated;
select pg_temp.act_as(:c3);
select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :s_sep),
  'RESULT_SEPARATION%', 'the member who generated the result cannot approve it');
select throws_like(format($q$select public.object_result_snapshot(%L, 'No')$q$, :s_sep),
  'RESULT_SEPARATION%', 'nor object to it');
reset role;
select is((public.committee_tally('result', :s_sep)->>'eligible')::int, 3,
  'the generator is not counted among those who answer');

-- High-level correction: every member must approve -------------------------------
select is((public.committee_tally('result', :s_high)->>'required')::int, 4,
  'a high-level correction needs all four members');
set local role authenticated;
select pg_temp.act_as(:c1);
select public.approve_result_snapshot(:s_high, null);
select pg_temp.act_as(:c2);
select is(public.object_result_snapshot(:s_high, 'Still wrong')->>'status', 'not_passed',
  'one objection fails a high-level result');
reset role;

-- Vice chair and no chair --------------------------------------------------------
select pg_temp.set_active(array[:c2, :c3, :c4, :c5]::uuid[]);
select is((select position_code from public.committee_chair()), 'vice_chair',
  'without a chair the vice chair breaks a tie');
select pg_temp.set_active(array[:c3, :c4, :c5, :c6]::uuid[]);
select is((select count(*)::int from public.committee_chair()), 0, 'no chair and no vice chair');
set local role authenticated;
select pg_temp.act_as(:c3);
select public.approve_result_snapshot(:s_nochair, null);
select pg_temp.act_as(:c4);
select public.approve_result_snapshot(:s_nochair, null);
select pg_temp.act_as(:c5);
select public.object_result_snapshot(:s_nochair, 'No');
select pg_temp.act_as(:c6);
select is(public.object_result_snapshot(:s_nochair, 'No')->>'status', 'tie', 'a tie without a chair');
select throws_like(format($q$select public.cast_committee_deciding_vote('result', %L, 'approve')$q$, :s_nochair),
  'COMMITTEE_NO_CHAIR%', 'nobody can break the tie without a chair');
select is(jsonb_typeof(public.committee_overview()->'chair'), 'null', 'the overview shows there is no chair');
reset role;

-- Closing voting early: answers are final, a tie waits for the chair ---------------
select pg_temp.set_active(array[:c1, :c2, :c3, :c4]::uuid[]);
set local role authenticated;
select pg_temp.act_as(:c1);
select public.propose_close_voting(:m_open, 'Everyone has voted', null);
select pg_temp.act_as(:c2);
select public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :m_open), 'approve', null);
select throws_like(
  format($q$select public.answer_close_request(%L, 'object', 'Changed my mind')$q$,
    (select id from public.meeting_close_requests where meeting_id = :m_open)),
  'RESULT_ALREADY_ANSWERED%', 'an answer to a close request cannot change');
select pg_temp.act_as(:c3);
select public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :m_open), 'object', 'Wait');
select pg_temp.act_as(:c4);
select is(public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :m_open),
  'object', 'Wait')->'tally'->>'status', 'tie', 'a 2 to 2 close request is tied');
select pg_temp.act_as(:c1);
select is(public.cast_committee_deciding_vote('close_request',
  (select id from public.meeting_close_requests where meeting_id = :m_open), 'approve')->>'status', 'passed',
  'the chair''s casting vote passes the request');
reset role;
select is((select status from public.meetings where id = :m_open), 'closed', 'voting is closed');

select * from finish();
rollback;
