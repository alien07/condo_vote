-- Database tests for committee approvals and vote closing (D014).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

\set admin_a  '''00000000-0000-4000-8000-0000000000f1'''
\set member_b '''00000000-0000-4000-8000-0000000000f2'''
\set member_c '''00000000-0000-4000-8000-0000000000f3'''
\set voter_d  '''00000000-0000-4000-8000-0000000000f4'''
\set closed_m '''10000000-0000-4000-8000-0000000000f1'''
\set open_m   '''10000000-0000-4000-8000-0000000000f2'''
\set snapshot '''50000000-0000-4000-8000-0000000000f1'''

insert into auth.users (id, email) values
  (:admin_a, 'admin.f@example.test'), (:member_b, 'member.b@example.test'),
  (:member_c, 'member.c@example.test'), (:voter_d, 'voter.d@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:admin_a, :admin_a, 'Admin F', 'admin.f@example.test', 'resident', 'approved'),
  (:member_b, :member_b, 'Member B', 'member.b@example.test', 'owner', 'approved'),
  (:member_c, :member_c, 'Member C', 'member.c@example.test', 'owner', 'approved'),
  (:voter_d, :voter_d, 'Voter D', 'voter.d@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values
  (:admin_a, 'admin'), (:member_b, 'committee'), (:member_c, 'committee');

insert into public.meetings (id, title, status, starts_at, ends_at, required_approvals) values
  (:closed_m, 'Approval test meeting', 'closed', now() - interval '2 hours', now() - interval '1 hour', 2),
  (:open_m, 'Close test meeting', 'published', now() - interval '1 hour', now() + interval '1 hour', 2);
insert into public.result_snapshots (id, meeting_id, payload_json) values (:snapshot, :closed_m, '{}');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

-- Result approvals ------------------------------------------------------------
select pg_temp.act_as(:voter_d);
set local role authenticated;

select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :snapshot),
  'RESULT_FORBIDDEN%', 'a voter without committee or admin role cannot approve');

select is(
  (select count(*)::int from public.result_snapshots where id = :snapshot),
  0, 'an unpublished snapshot is hidden from viewers');

select pg_temp.act_as(:admin_a);

select is(
  public.approve_result_snapshot(:snapshot, 'first')->>'published',
  'false', 'first of two approvals does not publish');

select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :snapshot),
  'RESULT_ALREADY_APPROVED%', 'the same approver cannot approve twice');

select pg_temp.act_as(:member_b);

select is(
  public.approve_result_snapshot(:snapshot, null)->>'published',
  'true', 'second approval reaches the minimum and publishes');

select is(
  (select count(*)::int from public.result_snapshots where id = :snapshot),
  1, 'a published snapshot is visible to viewers');

select pg_temp.act_as(:member_c);

select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :snapshot),
  'RESULT_ALREADY_PUBLISHED%', 'approvals stop after publishing');

reset role;

select is(
  (select approvals_count from public.result_publications where meeting_id = :closed_m),
  2, 'publication records the approval count');

select ok(
  exists (select 1 from public.email_logs where template_key = 'result_approved:' || :closed_m),
  'publishing queues result emails');

select throws_like(
  format($q$insert into public.result_snapshots (meeting_id, payload_json) values (%L, '{}')$q$, :closed_m),
  '%after committee approval%', 'no new snapshot after approvals');

-- Closing voting early -------------------------------------------------------
select pg_temp.act_as(:member_b);
set local role authenticated;

select is(
  public.approve_close_voting(:open_m)->>'closed',
  'false', 'first close approval keeps voting open');

select pg_temp.act_as(:member_c);

select is(
  public.approve_close_voting(:open_m)->>'closed',
  'true', 'second close approval closes voting');

reset role;

select is(
  (select status from public.meetings where id = :open_m),
  'closed', 'meeting status is closed');

select * from finish();
rollback;
