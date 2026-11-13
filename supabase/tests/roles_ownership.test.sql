-- Database tests for roles and room ownership (0031): office staff, auditor,
-- separation of duties, one owner of record, co-owner votes, and external
-- proxy holders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

\set staff_a   '''00000000-0000-4000-8000-0000000000b1'''
\set auditor_b '''00000000-0000-4000-8000-0000000000b2'''
\set admin_c   '''00000000-0000-4000-8000-0000000000b3'''
\set owner_d   '''00000000-0000-4000-8000-0000000000b4'''
\set resident_e '''00000000-0000-4000-8000-0000000000b5'''
\set proxy_f   '''00000000-0000-4000-8000-0000000000b6'''
\set room_a    '''40000000-0000-4000-8000-0000000000b1'''
\set owner_rec '''60000000-0000-4000-8000-0000000000b1'''
\set open_m    '''10000000-0000-4000-8000-0000000000b1'''
\set closed_m  '''10000000-0000-4000-8000-0000000000b2'''
\set snap      '''50000000-0000-4000-8000-0000000000b1'''

insert into auth.users (id, email) values
  (:staff_a, 'ro.staff@example.test'), (:auditor_b, 'ro.auditor@example.test'),
  (:admin_c, 'ro.admin@example.test'), (:owner_d, 'ro.owner@example.test'),
  (:resident_e, 'ro.resident@example.test'), (:proxy_f, 'ro.proxy@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:staff_a, :staff_a, 'Staff A', 'ro.staff@example.test', 'resident', 'approved'),
  (:auditor_b, :auditor_b, 'Auditor B', 'ro.auditor@example.test', 'resident', 'approved'),
  (:admin_c, :admin_c, 'Admin C', 'ro.admin@example.test', 'resident', 'approved'),
  (:owner_d, :owner_d, 'Owner D', 'ro.owner@example.test', 'owner', 'approved'),
  (:resident_e, :resident_e, 'Resident E', 'ro.resident@example.test', 'resident', 'approved'),
  (:proxy_f, :proxy_f, 'Proxy F', 'ro.proxy@example.test', 'proxy', 'approved');
insert into public.app_roles (profile_id, role) values
  (:staff_a, 'staff'), (:auditor_b, 'auditor'), (:admin_c, 'admin');
insert into public.rooms (id, room_number, ownership_percent) values (:room_a, 'R-101', 10);
insert into public.owners (id, full_name, email) values (:owner_rec, 'Owner D', 'ro.owner@example.test');
insert into public.room_owners (room_id, owner_id, status) values (:room_a, :owner_rec, 'active');

insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:open_m, 'Co-owner meeting', 'published', now() - interval '1 hour', now() + interval '1 day'),
  (:closed_m, 'Separation meeting', 'closed', now() - interval '3 hours', now() - interval '2 hours');
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
values (:open_m, :room_a, :owner_d, 'owner', 10, 'owner_master');
insert into public.result_snapshots (id, meeting_id, payload_json, generated_by)
values (:snap, :closed_m, '{}', :admin_c);

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

-- One owner of record ------------------------------------------------------------------
select throws_like(
  format($q$insert into public.room_owners (room_id, owner_id, ownership_role, status) values (%L, %L, 'co_owner', 'active')$q$,
    :room_a, :owner_rec),
  'OWNER_ROLE%', 'no new co-owner links');
select throws_like(
  format($q$insert into public.room_owners (room_id, owner_id, status) values (%L, %L, 'active')$q$,
    :room_a, :owner_rec),
  'ROOM_HAS_OWNER%', 'one open-ended owner of record per room');

set local role authenticated;

-- Office staff ---------------------------------------------------------------------------
select pg_temp.act_as(:staff_a);
select lives_ok($q$insert into public.rooms (room_number, ownership_percent) values ('R-STAFF', 1)$q$,
  'office staff add rooms');
select throws_like(
  $q$insert into public.meetings (title, status, starts_at, ends_at) values ('Staff meeting', 'draft', now(), now() + interval '1 hour')$q$,
  '%row-level security%', 'office staff cannot create meetings');
select ok((select count(*) from public.meetings where id = :open_m) = 1, 'office staff read meetings for their forms');

-- Auditor -----------------------------------------------------------------------------------
select pg_temp.act_as(:auditor_b);
select throws_like($q$insert into public.rooms (room_number, ownership_percent) values ('R-AUD', 1)$q$,
  '%row-level security%', 'an auditor cannot add rooms');
select lives_ok($q$select count(*) from public.audit_logs$q$, 'an auditor reads the audit log');
select is(public.is_approved_member(), true, 'an auditor reads published results');

-- Separation of duties ----------------------------------------------------------------------
select pg_temp.act_as(:admin_c);
select throws_like(format($q$select public.approve_result_snapshot(%L, null)$q$, :snap),
  'RESULT_SEPARATION%', 'whoever generated a result cannot approve it');

-- Co-owner votes ------------------------------------------------------------------------------
select pg_temp.act_as(:resident_e);
select throws_like(
  format($q$select public.grant_co_owner_vote(%L, %L, 'ro.resident@example.test')$q$, :open_m, :room_a),
  'VOTE_NOT_OWNER%', 'only the owner of record can let a co-owner vote');

select pg_temp.act_as(:owner_d);
select throws_like(
  format($q$select public.grant_co_owner_vote(%L, %L, 'nobody@example.test')$q$, :open_m, :room_a),
  'VOTE_CO_OWNER_NOT_FOUND%', 'the co-owner must be an approved resident');
select lives_ok(
  format($q$select public.grant_co_owner_vote(%L, %L, 'ro.resident@example.test')$q$, :open_m, :room_a),
  'the owner lets a co-owner vote');

reset role;
select is(
  (select profile_id from public.eligible_voters_snapshot where meeting_id = :open_m and room_id = :room_a),
  :resident_e::uuid, 'the room moves to the co-owner');
set local role authenticated;
select pg_temp.act_as(:owner_d);

select is(
  (public.my_member_access()->'delegated_rooms'->0->>'can_cancel')::boolean, true,
  'the owner sees the room and can take it back');
select lives_ok(
  format($q$select public.cancel_co_owner_vote(%L)$q$,
    (select id from public.proxy_authorizations where meeting_id = :open_m and room_id = :room_a and kind = 'co_owner')),
  'the owner takes it back before the co-owner votes');

reset role;
select is(
  (select profile_id from public.eligible_voters_snapshot where meeting_id = :open_m and room_id = :room_a),
  :owner_d::uuid, 'the room is back with the owner');
set local role authenticated;

-- External proxy holder -------------------------------------------------------------------
select pg_temp.act_as(:proxy_f);
select is(public.is_approved_member(), false,
  'an external proxy holder without an open meeting has no access');

reset role;

select * from finish();
rollback;
