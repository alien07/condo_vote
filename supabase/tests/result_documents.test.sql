-- Database tests for voting phases, meeting record data, and snapshot hashes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

\set owner_a '''00000000-0000-4000-8000-0000000000d7'''
\set admin_b '''00000000-0000-4000-8000-0000000000d8'''
\set room_a  '''40000000-0000-4000-8000-0000000000d7'''
\set adv_m   '''10000000-0000-4000-8000-0000000000d7'''
\set gap_m   '''10000000-0000-4000-8000-0000000000d8'''
\set q_adv   '''20000000-0000-4000-8000-0000000000d7'''
\set q_gap   '''20000000-0000-4000-8000-0000000000d8'''
\set c_adv   '''30000000-0000-4000-8000-0000000000d7'''
\set c_gap   '''30000000-0000-4000-8000-0000000000d8'''

insert into auth.users (id, email) values
  (:owner_a, 'phase.owner@example.test'), (:admin_b, 'phase.admin@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:owner_a, :owner_a, 'Owner A', 'phase.owner@example.test', 'owner', 'approved'),
  (:admin_b, :admin_b, 'Admin B', 'phase.admin@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin_b, 'admin');
insert into public.rooms (id, room_number, ownership_percent) values (:room_a, 'P-101', 10);

-- Advance voting is open now; the meeting day is tomorrow.
insert into public.meetings (id, title, status, advance_starts_at, advance_ends_at, starts_at, ends_at) values
  (:adv_m, 'Advance open', 'published', now() - interval '1 hour', now() + interval '1 hour',
   now() + interval '1 day', now() + interval '1 day 2 hours'),
-- Between the phases: advance ended, meeting day not started.
  (:gap_m, 'Between phases', 'published', now() - interval '3 hours', now() - interval '1 hour',
   now() + interval '1 day', now() + interval '1 day 2 hours');
insert into public.meeting_questions (id, meeting_id, question_text, question_type, required, display_order) values
  (:q_adv, :adv_m, 'Advance question', 'single_choice', true, 1),
  (:q_gap, :gap_m, 'Gap question', 'single_choice', true, 1);
insert into public.meeting_choices (id, question_id, choice_text, display_order) values
  (:c_adv, :q_adv, 'Yes', 1), (:c_gap, :q_gap, 'Yes', 1);
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source) values
  (:adv_m, :room_a, :owner_a, 'owner', 10, 'owner_master'),
  (:gap_m, :room_a, :owner_a, 'owner', 10, 'owner_master');

select throws_like(
  $q$insert into public.meetings (title, status, advance_starts_at, advance_ends_at, starts_at, ends_at)
     values ('Bad', 'draft', now(), now() + interval '2 days', now() + interval '1 day', now() + interval '3 days')$q$,
  '%meetings_advance_window_check%', 'advance voting must end before the meeting day');

select throws_like(
  $q$insert into public.meetings (title, status, advance_starts_at, starts_at, ends_at)
     values ('Half', 'draft', now(), now() + interval '1 day', now() + interval '2 days')$q$,
  '%meetings_advance_window_check%', 'advance voting needs both times');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as(:owner_a);

select is(
  (public.submit_ballot(:adv_m, :room_a, jsonb_build_array(
    jsonb_build_object('question_id', :q_adv, 'choice_ids', jsonb_build_array(:c_adv))))->>'version_number')::int,
  1, 'owner can vote during advance voting');

select throws_like(
  format($q$select public.submit_ballot(%L, %L, jsonb_build_array(jsonb_build_object('question_id', %L, 'choice_ids', jsonb_build_array(%L))))$q$,
    :gap_m, :room_a, :q_gap, :c_gap),
  'VOTE_CLOSED%', 'voting is closed between the phases');

-- Incidents: admin only writes, owners cannot read.
select throws_like(
  format($q$insert into public.meeting_incidents (meeting_id, started_at, description) values (%L, now(), 'x')$q$, :adv_m),
  '%row-level security%', 'an owner cannot record incidents');

select pg_temp.act_as(:admin_b);

select lives_ok(
  format($q$insert into public.meeting_incidents (meeting_id, started_at, description, action_taken)
            values (%L, now() - interval '30 minutes', 'Login outage', 'Paper ballots')$q$, :adv_m),
  'admin records an incident');

select pg_temp.act_as(:owner_a);

select is((select count(*)::int from public.meeting_incidents), 0, 'owners do not see incidents');

reset role;

-- Snapshot hash is set on insert and matches the payload.
insert into public.result_snapshots (id, meeting_id, payload_json)
values ('50000000-0000-4000-8000-0000000000d7', :gap_m, '{"b": 2, "a": 1}');

select is(
  (select payload_sha256 from public.result_snapshots where id = '50000000-0000-4000-8000-0000000000d7'),
  encode(sha256(convert_to('{"a": 1, "b": 2}', 'UTF8')), 'hex'),
  'snapshot SHA-256 is computed from the stored JSON text');

select is(
  (select length(payload_sha256) from public.result_snapshots where id = '50000000-0000-4000-8000-0000000000d7'),
  64, 'hash is 64 hex characters');

select throws_like(
  $q$insert into public.condo_profiles (juristic_name, project_name, record_signatories)
     values ('J', 'P', array['nobody'])$q$,
  '%record_signatories_check%', 'only known signatory roles are allowed');

select * from finish();
rollback;
