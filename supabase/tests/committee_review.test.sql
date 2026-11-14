-- Database tests for the committee review rules (0034, 0035): the proposer of a
-- close-early request cannot object, the last ended request is shown, one
-- open correction per result, no correction after approving, and publishing
-- waits for an open correction.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

\set admin_a  '''00000000-0000-4000-8000-0000000000d1'''
\set member_b '''00000000-0000-4000-8000-0000000000d2'''
\set member_c '''00000000-0000-4000-8000-0000000000d3'''
\set open_m   '''10000000-0000-4000-8000-0000000000d1'''
\set closed_m '''10000000-0000-4000-8000-0000000000d2'''
\set snap     '''50000000-0000-4000-8000-0000000000d1'''

insert into auth.users (id, email) values
  (:admin_a, 'rev.admin@example.test'), (:member_b, 'rev.b@example.test'), (:member_c, 'rev.c@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:admin_a, :admin_a, 'Admin A', 'rev.admin@example.test', 'resident', 'approved'),
  (:member_b, :member_b, 'Member B', 'rev.b@example.test', 'owner', 'approved'),
  (:member_c, :member_c, 'Member C', 'rev.c@example.test', 'owner', 'approved');
insert into public.app_roles (profile_id, role) values
  (:admin_a, 'admin'), (:member_b, 'committee'), (:member_c, 'committee');
-- Only these two are active members here, even with demo data (rolled back).
update public.committee_members set active = false;
insert into public.committee_members (profile_id, full_name, position_title, display_order) values
  (:member_b, 'Member B', 'Chair', 1), (:member_c, 'Member C', 'Secretary', 2);

insert into public.meetings (id, title, status, starts_at, ends_at, required_approvals) values
  (:open_m, 'Review open meeting', 'published', now() - interval '1 hour', now() + interval '2 hours', 2),
  (:closed_m, 'Review closed meeting', 'closed', now() - interval '3 hours', now() - interval '2 hours', 2);
insert into public.result_snapshots (id, meeting_id, payload_json, generated_at, generated_by)
values (:snap, :closed_m, '{"questions": []}', now() - interval '1 hour', :admin_a);

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Close early: the proposer cancels instead of objecting ----------------------------
select pg_temp.act_as(:member_b);
select lives_ok(format($q$select public.propose_close_voting(%L, 'Everyone voted', null)$q$, :open_m),
  'a member proposes closing early');
select throws_like(
  format($q$select public.answer_close_request(%L, 'object', 'Changed my mind')$q$,
    (select id from public.meeting_close_requests where meeting_id = :open_m)),
  'RESULT_PROPOSER_OBJECT%', 'the proposer cannot object to their own request');
select lives_ok(
  format($q$select public.cancel_close_request(%L)$q$,
    (select id from public.meeting_close_requests where meeting_id = :open_m)),
  'the proposer cancels instead');
select is(
  (select item->'last_request'->>'status' from jsonb_array_elements(public.committee_overview()->'open_meetings') item
   where item->>'id' = :open_m),
  'cancelled', 'the card shows what happened to the last request');
select throws_like(
  format($q$select public.propose_close_voting(%L, %L, null)$q$, :open_m, repeat('a', 501)),
  '%meeting_close_requests_reason_length%', 'a reason is at most 500 characters');

-- Corrections: one at a time, not after approving -------------------------------------
select lives_ok(format($q$select public.approve_result_snapshot(%L, null)$q$, :snap), 'member B approves');
select throws_like(
  format($q$select public.request_result_correction(%L, 'other', 'Looks wrong', null)$q$, :snap),
  'RESULT_APPROVED_ALREADY%', 'a member who approved cannot request a correction');

select pg_temp.act_as(:member_c);
select lives_ok(
  format($q$select public.request_result_correction(%L, 'wording', 'Typo in agenda 1', null)$q$, :snap),
  'member C requests a correction');
select throws_like(
  format($q$select public.request_result_correction(%L, 'other', 'Another thing', null)$q$, :snap),
  'RESULT_CORRECTION_OPEN%', 'one open correction per result at a time');

-- Publishing waits for the open correction ---------------------------------------------
-- Member C approves too (allowed while a correction is open): approvals are complete.
select is(
  public.approve_result_snapshot(:snap, null)->>'held', 'true',
  'complete approvals are held while a correction is open');

select pg_temp.act_as(:admin_a);
select is(
  public.answer_correction_request(
    (select id from public.result_correction_requests where meeting_id = :closed_m), 'no_change', 'Wording is right'
  )->>'published', 'true',
  'answering "No change needed" publishes the fully approved result');

reset role;

select * from finish();
rollback;
