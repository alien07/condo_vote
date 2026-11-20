-- The System Admin is apart from the building (req_0011 B, D027): no
-- building rights from the role; temporary access reads, never writes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

\set sys     '''00000000-0000-4000-8000-0000000002a1'''
\set sys2    '''00000000-0000-4000-8000-0000000002a2'''
\set manager '''00000000-0000-4000-8000-0000000002a3'''
\set room    '''20000000-0000-4000-8000-0000000002a1'''
\set meeting '''10000000-0000-4000-8000-0000000002a1'''

insert into auth.users (id, email) values
  (:sys, 'sa.one@example.test'), (:sys2, 'sa.two@example.test'), (:manager, 'sa.manager@example.test');
-- A platform account: 'proxy' status without a proxy has no member access.
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:sys, :sys, 'System One', 'sa.one@example.test', 'proxy', 'approved'),
  (:sys2, :sys2, 'System Two', 'sa.two@example.test', 'proxy', 'approved'),
  (:manager, :manager, 'Manager M', 'sa.manager@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values
  (:sys, 'system_admin'), (:manager, 'admin');
-- Only these system admins exist in this test.
delete from public.app_roles where role = 'system_admin' and profile_id <> :sys;
insert into public.rooms (id, room_number, ownership_percent) values (:room, 'SA-1', 10);
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:meeting, 'SA meeting', 'draft', now() + interval '10 days', now() + interval '11 days');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

-- No building rights from the role ------------------------------------------
select pg_temp.act_as(:sys);
set local role authenticated;

select is(public.is_approved_member(), false, 'system_admin alone is not a member');
select is((select count(*)::int from public.rooms where id = :room), 0, 'cannot read rooms');
select is((select count(*)::int from public.profiles where id = :manager), 0, 'cannot read other profiles');
select is((select count(*)::int from public.app_roles where profile_id = :manager), 0, 'cannot see building roles');
select throws_like(format($q$insert into public.app_roles (profile_id, role) values (%L, 'admin')$q$, :sys),
  '%row-level security%', 'cannot make themselves Manager');
select throws_like($q$select public.committee_overview()$q$, 'RESULT_FORBIDDEN%', 'cannot open the committee data');
select throws_like($q$select public.result_decisions()$q$, 'RESULT_FORBIDDEN%', 'cannot read result decisions');

-- Temporary access -----------------------------------------------------------
select throws_like($q$select public.start_system_read_access('Support ticket 12', 2)$q$,
  'SYSTEM_ACCESS_HOURS%', 'only 1, 4 or 24 hours');
select throws_like($q$select public.start_system_read_access('  ', 1)$q$,
  'SYSTEM_REASON_REQUIRED%', 'a reason is required');
select lives_ok($q$select public.start_system_read_access('Support ticket 12', 1)$q$, 'opens for one hour');
select throws_like($q$select public.start_system_read_access('Again', 4)$q$,
  'SYSTEM_ACCESS_OPEN%', 'one open access at a time');
select is(public.system_read_access_active(), true, 'the access is active');
select is((select count(*)::int from public.rooms where id = :room), 1, 'reads rooms while active');
select is((select count(*)::int from public.profiles where id = :manager), 1, 'reads profiles while active');
select lives_ok($q$select public.committee_overview()$q$, 'reads the committee data while active');

-- Read only: the database refuses every write.
select throws_like(format($q$insert into public.rooms (room_number, ownership_percent) values ('SA-2', 1)$q$),
  '%row-level security%', 'cannot add a room');
update public.meetings set title = 'Changed' where id = :meeting;
select is((select title from public.meetings where id = :meeting), 'SA meeting', 'an update changes nothing');
select throws_like(format($q$insert into public.app_roles (profile_id, role) values (%L, 'staff')$q$, :sys),
  '%row-level security%', 'still cannot grant building roles');

-- The Manager sees it (banner).
select pg_temp.act_as(:manager);
select is(jsonb_array_length(public.system_access_status()->'active'), 1, 'the Manager sees the active access');

select pg_temp.act_as(:sys);
select lives_ok($q$select public.end_system_read_access()$q$, 'ends early');
select is((select count(*)::int from public.rooms where id = :room), 0, 'no reads after it ends');
reset role;
select is((select array_agg(action order by created_at)::text from public.audit_logs where actor_profile_id = :sys
           and action like 'system_access.%'), '{system_access.started,system_access.ended}',
  'start and end are in the audit log');

-- Expiry is recorded when first noticed.
insert into public.system_read_access (profile_id, reason, starts_at, ends_at)
values (:sys, 'Old access', now() - interval '3 hours', now() - interval '2 hours');
select pg_temp.act_as(:manager);
set local role authenticated;
select is(jsonb_array_length(public.system_access_status()->'active'), 0, 'an expired access is not active');
reset role;
select is((select count(*)::int from public.audit_logs where actor_profile_id = :sys and action = 'system_access.expired'), 1,
  'the expiry is in the audit log');

-- System admins manage only system admins.
select pg_temp.act_as(:sys);
set local role authenticated;
select is(public.grant_system_admin('SA.Two@example.test')->>'profile_id', :sys2::text, 'grants by email');
select lives_ok(format($q$select public.revoke_system_admin(%L)$q$, :sys2), 'removes another system admin');
select throws_like(format($q$select public.revoke_system_admin(%L)$q$, :sys),
  'SYSTEM_LAST_ADMIN%', 'keeps the last system admin');
reset role;

select * from finish();
rollback;
