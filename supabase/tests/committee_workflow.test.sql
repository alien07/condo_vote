-- Database tests for the committee workflow (0030): close-early requests with
-- objections, and result correction requests.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

\set admin_a  '''00000000-0000-4000-8000-0000000000a1'''
\set member_b '''00000000-0000-4000-8000-0000000000a2'''
\set member_c '''00000000-0000-4000-8000-0000000000a3'''
\set member_e '''00000000-0000-4000-8000-0000000000a5'''
\set open_m   '''10000000-0000-4000-8000-0000000000a1'''
\set later_m  '''10000000-0000-4000-8000-0000000000a2'''
\set closed_m '''10000000-0000-4000-8000-0000000000a3'''
\set snap_1   '''50000000-0000-4000-8000-0000000000a1'''

insert into auth.users (id, email) values
  (:admin_a, 'flow.admin@example.test'), (:member_b, 'flow.b@example.test'),
  (:member_c, 'flow.c@example.test'), (:member_e, 'flow.e@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:admin_a, :admin_a, 'Admin A', 'flow.admin@example.test', 'resident', 'approved'),
  (:member_b, :member_b, 'Member B', 'flow.b@example.test', 'owner', 'approved'),
  (:member_c, :member_c, 'Member C', 'flow.c@example.test', 'owner', 'approved'),
  (:member_e, :member_e, 'Member E', 'flow.e@example.test', 'owner', 'approved');
insert into public.app_roles (profile_id, role) values
  (:admin_a, 'admin'), (:member_b, 'committee'), (:member_c, 'committee'), (:member_e, 'committee');
-- Only these three are active members here, even on a database with demo
-- data (the test rolls back, so nothing is changed for real).
update public.committee_members set active = false;
insert into public.committee_members (profile_id, full_name, position_title, display_order) values
  (:member_b, 'Member B', 'Chair', 1), (:member_c, 'Member C', 'Secretary', 2),
  (:member_e, 'Member E', 'Member', 3);

insert into public.meetings (id, title, status, starts_at, ends_at, required_approvals) values
  (:open_m, 'Objection meeting', 'published', now() - interval '1 hour', now() + interval '2 hours', 2),
  (:later_m, 'Scheduled close meeting', 'published', now() - interval '1 hour', now() + interval '3 hours', 2),
  (:closed_m, 'Correction meeting', 'closed', now() - interval '3 hours', now() - interval '2 hours', 2);
insert into public.result_snapshots (id, meeting_id, payload_json, generated_at)
values (:snap_1, :closed_m, '{"questions": []}', now() - interval '1 hour');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Close early: objections -----------------------------------------------------------
select pg_temp.act_as(:member_b);
select throws_like(format($q$select public.propose_close_voting(%L, ' ', null)$q$, :open_m),
  'RESULT_REASON_REQUIRED%', 'a proposal needs a reason');
select is(public.propose_close_voting(:open_m, 'All rooms have voted', null)->>'status', 'open',
  'a proposal with one approval stays open');
select throws_like(format($q$select public.propose_close_voting(%L, 'Again', null)$q$, :open_m),
  'RESULT_REQUEST_OPEN%', 'one open request per meeting');

select pg_temp.act_as(:admin_a);
select throws_like(
  format($q$select public.answer_close_request(%L, 'approve', null)$q$,
    (select id from public.meeting_close_requests where meeting_id = :open_m)),
  'RESULT_FORBIDDEN%', 'an admin outside the committee cannot answer');

select pg_temp.act_as(:member_c);
select throws_like(
  format($q$select public.answer_close_request(%L, 'object', '')$q$,
    (select id from public.meeting_close_requests where meeting_id = :open_m)),
  'RESULT_REASON_REQUIRED%', 'an objection needs a reason');
select is(
  public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :open_m),
    'object', 'Some owners vote on the day')->>'status',
  'open', 'one objection: the minimum can still be reached');

select pg_temp.act_as(:member_e);
select is(
  public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :open_m),
    'object', 'Wait for the end time')->>'status',
  'failed', 'too few members left: the request fails');

reset role;
select is((select status from public.meetings where id = :open_m), 'published', 'voting stays open');
select ok(exists (select 1 from public.email_logs
  where template_key = 'close_request_failed:' || :open_m and recipient_email = 'flow.b@example.test'),
  'the proposer is emailed when the request fails');
select is((select count(*)::int from public.meeting_close_request_answers a
  join public.meeting_close_requests r on r.id = a.request_id
  where r.meeting_id = :open_m and a.answer = 'object' and a.reason is not null), 2,
  'each objection keeps its reason');

-- Close early: at a set time -------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:member_b);
select throws_like(
  format($q$select public.propose_close_voting(%L, 'Late', now() + interval '5 hours')$q$, :later_m),
  'RESULT_CLOSE_TIME%', 'the close time must be before the set end time');
select lives_ok(
  format($q$select public.propose_close_voting(%L, 'Close at noon', now() + interval '1 hour')$q$, :later_m),
  'a proposal with a close time');
select pg_temp.act_as(:member_c);
select is(
  public.answer_close_request((select id from public.meeting_close_requests where meeting_id = :later_m),
    'approve', null)->>'status',
  'approved', 'approved at the minimum');
reset role;
select ok(
  (select ends_at < now() + interval '2 hours' and status = 'published' from public.meetings where id = :later_m),
  'voting stays open until the new close time');

-- Correction requests ------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:member_b);
select lives_ok(format($q$select public.approve_result_snapshot(%L, null)$q$, :snap_1), 'first approval');
-- A member who approved cannot request a correction (0034); another member does.
select pg_temp.act_as(:member_c);
select is(
  public.request_result_correction(:snap_1, 'other', 'Room A-1 share looks wrong', null)->>'level',
  'medium', '"Other" starts at medium');

select pg_temp.act_as(:admin_a);
select throws_like(
  format($q$select public.raise_correction_level(%L, 'low', 'Just a typo')$q$,
    (select id from public.result_correction_requests where meeting_id = :closed_m)),
  'RESULT_LEVEL_DOWN%', 'the level never goes down');

reset role;
-- While the request is open the admin may generate the result again.
insert into public.result_snapshots (meeting_id, payload_json) values (:closed_m, '{"questions": []}');
select ok(exists (select 1 from public.email_logs
  where template_key = 'result_review_again:' || :closed_m and recipient_email = 'flow.b@example.test'),
  'the member who approved the old result is asked to review again');

set local role authenticated;
select pg_temp.act_as(:member_c);
select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :snap_1),
  'RESULT_OTHER_SNAPSHOT%', 'the old result can no longer be approved');

reset role;

select * from finish();
rollback;
