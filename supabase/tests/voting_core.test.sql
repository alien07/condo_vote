-- Database tests for the voting core service (D010-D012).
-- Run: npm run test:db  (needs local Supabase: npm run supabase:start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixed ids keep the assertions readable.
\set owner_a   '''00000000-0000-4000-8000-0000000000a1'''
\set proxy_b   '''00000000-0000-4000-8000-0000000000b1'''
\set proxy_c   '''00000000-0000-4000-8000-0000000000c1'''
\set admin_d   '''00000000-0000-4000-8000-0000000000d1'''
\set meeting   '''10000000-0000-4000-8000-000000000001'''
\set closed_m  '''10000000-0000-4000-8000-000000000002'''
\set q_single  '''20000000-0000-4000-8000-000000000001'''
\set q_multi   '''20000000-0000-4000-8000-000000000002'''
\set c_yes     '''30000000-0000-4000-8000-000000000001'''
\set c_no      '''30000000-0000-4000-8000-000000000002'''
\set c_m1      '''30000000-0000-4000-8000-000000000003'''
\set c_m2      '''30000000-0000-4000-8000-000000000004'''
\set c_closed  '''30000000-0000-4000-8000-000000000005'''

-- Setup (as postgres) ---------------------------------------------------------
insert into auth.users (id, email) values
  (:owner_a, 'owner.a@example.test'),
  (:proxy_b, 'proxy.b@example.test'),
  (:proxy_c, 'proxy.c@example.test'),
  (:admin_d, 'admin.d@example.test');

insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:owner_a, :owner_a, 'Owner A', 'owner.a@example.test', 'owner', 'approved'),
  (:proxy_b, :proxy_b, 'Proxy B', 'proxy.b@example.test', 'proxy', 'approved'),
  (:proxy_c, :proxy_c, 'Proxy C', 'proxy.c@example.test', 'proxy', 'approved'),
  (:admin_d, :admin_d, 'Admin D', 'admin.d@example.test', 'resident', 'approved');

insert into public.app_roles (profile_id, role) values (:admin_d, 'admin');

insert into public.rooms (id, room_number, ownership_percent)
select ('40000000-0000-4000-8000-00000000000' || n)::uuid, 'T-10' || n, 10
from generate_series(1, 6) as n;

insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:meeting, 'Open test meeting', 'published', now() - interval '1 hour', now() + interval '1 hour'),
  (:closed_m, 'Closed test meeting', 'published', now() - interval '2 hours', now() - interval '1 hour');

insert into public.meeting_questions (id, meeting_id, question_text, question_type, required, display_order) values
  (:q_single, :meeting, 'Single question', 'single_choice', true, 1),
  (:q_multi, :meeting, 'Multi question', 'multiple_choice', false, 2),
  ('20000000-0000-4000-8000-000000000003', :closed_m, 'Closed question', 'single_choice', true, 1);

insert into public.meeting_choices (id, question_id, choice_text, display_order) values
  (:c_yes, :q_single, 'Yes', 1),
  (:c_no, :q_single, 'No', 2),
  (:c_m1, :q_multi, 'Option 1', 1),
  (:c_m2, :q_multi, 'Option 2', 2),
  (:c_closed, '20000000-0000-4000-8000-000000000003', 'Yes', 1);

insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source) values
  (:meeting, '40000000-0000-4000-8000-000000000001', :owner_a, 'owner', 10, 'owner_master'),
  (:closed_m, '40000000-0000-4000-8000-000000000001', :owner_a, 'owner', 10, 'owner_master');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

-- Online ballots (D010, D011) -------------------------------------------------
select pg_temp.act_as(:owner_a);
set local role authenticated;

select is(
  (public.submit_ballot(:meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(
      jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes)),
      jsonb_build_object('question_id', :q_multi, 'choice_ids', jsonb_build_array(:c_m1, :c_m2))
    ))->>'version_number')::int,
  1, 'eligible owner submits version 1');

select is(
  (public.submit_ballot(:meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_no))))->>'version_number')::int,
  2, 'same voter edits to version 2');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes, :c_no)))),
  'VOTE_INVALID_ANSWERS%', 'single choice rejects two choices');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_multi, 'choice_ids', jsonb_build_array(:c_m1)))),
  'VOTE_INVALID_ANSWERS%', 'missing required question is rejected');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_m1)))),
  'VOTE_INVALID_ANSWERS%', 'choice from another question is rejected');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :closed_m, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', '20000000-0000-4000-8000-000000000003', 'choice_ids', jsonb_build_array(:c_closed)))),
  'VOTE_CLOSED%', 'closed voting window is rejected');

select pg_temp.act_as(:proxy_b);

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes)))),
  'VOTE_NOT_ELIGIBLE%', 'voter outside the snapshot is rejected');

reset role;

select is(
  (select count(*)::int from public.ballot_answers a
   join public.ballots b on b.id = a.ballot_id
   where b.meeting_id = :meeting),
  1, 'edit replaces answers (one answer after version 2)');

select is(
  (select count(*)::int from public.ballot_versions v
   join public.ballots b on b.id = v.ballot_id
   where b.meeting_id = :meeting),
  2, 'every submit stores a ballot version');

select is(
  (select count(*)::int from public.audit_logs where action in ('ballot.submitted', 'ballot.updated') and actor_profile_id = :owner_a),
  2, 'every submit writes an audit entry');

-- Room lock: the snapshot moves to another voter after the room already voted.
update public.eligible_voters_snapshot
set profile_id = :proxy_b, voter_type = 'proxy', source = 'proxy_authorization'
where meeting_id = :meeting and room_id = '40000000-0000-4000-8000-000000000001';

select pg_temp.act_as(:proxy_b);
set local role authenticated;

select throws_like(
  format($q$select public.submit_ballot(%L, %L, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes)))),
  'VOTE_ROOM_LOCKED%', 'second voter cannot change a locked room');

reset role;

-- Proxy limit (D012) ----------------------------------------------------------
insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id, status)
select :meeting, ('40000000-0000-4000-8000-00000000000' || n)::uuid, :proxy_b, 'pending'
from generate_series(2, 4) as n;

select is(
  (select count(*)::int from public.proxy_authorizations where proxy_profile_id = :proxy_b),
  3, 'a proxy can hold three rooms');

select throws_like(
  format($q$insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id) values (%L, %L, %L)$q$,
    :meeting, '40000000-0000-4000-8000-000000000005', :proxy_b),
  'VOTE_PROXY_LIMIT%', 'a fourth room for the same proxy is rejected');

-- Proxy changes after publishing (D011) ---------------------------------------
update public.proxy_authorizations set status = 'approved'
where proxy_profile_id = :proxy_b and room_id = '40000000-0000-4000-8000-000000000002';

select is(
  (select profile_id from public.eligible_voters_snapshot
   where meeting_id = :meeting and room_id = '40000000-0000-4000-8000-000000000002'),
  :proxy_b::uuid, 'approving a proxy after publishing makes the proxy the room voter');

update public.proxy_authorizations set status = 'revoked'
where proxy_profile_id = :proxy_b and room_id = '40000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::int from public.eligible_voters_snapshot
   where meeting_id = :meeting and room_id = '40000000-0000-4000-8000-000000000002'),
  0, 'revoking the proxy removes it (room has no linked owner in this test)');

insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id, status)
values (:meeting, '40000000-0000-4000-8000-000000000001', :proxy_c, 'pending');

select throws_like(
  format($q$update public.proxy_authorizations set status = 'approved' where proxy_profile_id = %L$q$, :proxy_c),
  'VOTE_ROOM_ALREADY_VOTED%', 'proxy cannot change for a room that already voted');

-- Manual ballots and conflicts (D010) -----------------------------------------
select pg_temp.act_as(:owner_a);
set local role authenticated;

select throws_like(
  format($q$select public.submit_manual_ballot(%L, %L, %L, null, null, %L)$q$, :meeting, '40000000-0000-4000-8000-000000000001', :owner_a,
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes)))),
  'VOTE_FORBIDDEN%', 'non-admin cannot import manual ballots');

select pg_temp.act_as(:admin_d);

select ok(
  (public.submit_manual_ballot(:meeting, '40000000-0000-4000-8000-000000000001', :owner_a, null, 'paper',
    jsonb_build_array(jsonb_build_object('question_id', :q_single, 'choice_ids', jsonb_build_array(:c_yes))))->>'manual_ballot_id') is not null,
  'admin imports a manual ballot');

-- Read ballot ids as postgres; RLS hides them from the test role.
reset role;
select
  (select id from public.ballots where meeting_id = :meeting) as online_ballot,
  (select id from public.manual_ballots where meeting_id = :meeting) as manual_ballot
\gset
set local role authenticated;

select throws_like(
  format($q$select public.resolve_vote_source_conflict(%L, %L, %L, %L, 'online', 'x')$q$,
    :meeting, '40000000-0000-4000-8000-000000000003', :'online_ballot', :'manual_ballot'),
  'VOTE_INVALID_CONFLICT%', 'conflict ballots must match the room');

select ok(
  (public.resolve_vote_source_conflict(:meeting, '40000000-0000-4000-8000-000000000001',
    :'online_ballot', :'manual_ballot', 'online', 'Use online'))->>'resolution_id' is not null,
  'admin resolves a conflict');

reset role;

select * from finish();
rollback;
