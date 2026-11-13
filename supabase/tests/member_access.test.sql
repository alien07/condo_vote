-- Database tests for member access (0029): only approved members read
-- published results; my_member_access() drives the menus.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

\set owner_a   '''00000000-0000-4000-8000-0000000000e1'''
\set pending_b '''00000000-0000-4000-8000-0000000000e2'''
\set reject_c  '''00000000-0000-4000-8000-0000000000e3'''
\set resid_d   '''00000000-0000-4000-8000-0000000000e4'''
\set proxy_e   '''00000000-0000-4000-8000-0000000000e5'''
\set room_a    '''40000000-0000-4000-8000-0000000000e1'''
\set room_b    '''40000000-0000-4000-8000-0000000000e2'''
\set owner_rec '''60000000-0000-4000-8000-0000000000e1'''
\set meet_pub  '''10000000-0000-4000-8000-0000000000e1'''
\set meet_open '''10000000-0000-4000-8000-0000000000e2'''
\set snap      '''50000000-0000-4000-8000-0000000000e1'''

insert into auth.users (id, email) values
  (:owner_a, 'access.owner@example.test'),
  (:pending_b, 'access.pending@example.test'),
  (:reject_c, 'access.rejected@example.test'),
  (:resid_d, 'access.resident@example.test'),
  (:proxy_e, 'access.proxy@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:owner_a, :owner_a, 'Owner A', 'access.owner@example.test', 'owner', 'approved'),
  (:pending_b, :pending_b, 'Pending B', 'access.pending@example.test', 'resident', 'pending'),
  (:reject_c, :reject_c, 'Rejected C', 'access.rejected@example.test', 'resident', 'rejected'),
  (:resid_d, :resid_d, 'Resident D', 'access.resident@example.test', 'resident', 'approved'),
  (:proxy_e, :proxy_e, 'Proxy E', 'access.proxy@example.test', 'resident', 'approved');
insert into public.rooms (id, room_number, ownership_percent) values
  (:room_a, 'X-101', 10), (:room_b, 'X-102', 10);
insert into public.owners (id, full_name, email) values
  (:owner_rec, 'Owner A', 'access.owner@example.test');
insert into public.room_owners (room_id, owner_id, status) values
  (:room_a, :owner_rec, 'active'), (:room_b, :owner_rec, 'active');

insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:meet_pub, 'Published result', 'closed', now() - interval '3 days', now() - interval '2 days'),
  (:meet_open, 'Open meeting', 'published', now() - interval '1 hour', now() + interval '1 day');
insert into public.result_snapshots (id, meeting_id, payload_json) values (:snap, :meet_pub, '{"a": 1}');
insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count)
values (:meet_pub, :snap, 1);
insert into public.committee_approvals (meeting_id, result_snapshot_id, approved_by)
values (:meet_pub, :snap, :owner_a);

-- Room X-102 is held by a proxy in the open meeting.
insert into public.proxy_authorizations (meeting_id, room_id, owner_id, proxy_profile_id, status)
values (:meet_open, :room_b, :owner_rec, :proxy_e, 'approved');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Approved owner -----------------------------------------------------------------
select pg_temp.act_as(:owner_a);
select is((select count(*)::int from public.result_snapshots where id = :snap), 1,
  'an approved owner reads a published result');
select is((public.my_member_access()->>'can_vote')::boolean, true, 'an owner can vote');
select is(jsonb_array_length(public.my_member_access()->'delegated_rooms'), 1,
  'the owner sees the room a proxy holds');
select is(public.my_member_access()->'delegated_rooms'->0->>'proxy_name', 'Proxy E',
  'and who holds it');

-- Pending account ----------------------------------------------------------------
select pg_temp.act_as(:pending_b);
select is((select count(*)::int from public.result_snapshots), 0, 'a pending account reads no result');
select is((select count(*)::int from public.result_publications), 0, 'nor publications');
select is((select count(*)::int from public.committee_approvals), 0, 'nor who approved');
select is((public.my_member_access()->>'can_view_results')::boolean, false,
  'the app hides results from a pending account');
select isnt(public.verify_result_reference(:snap)->>'payload_sha256', null,
  'a pending account can still check a reference (hash only)');

-- Rejected account ---------------------------------------------------------------
select pg_temp.act_as(:reject_c);
select is((select count(*)::int from public.result_snapshots), 0, 'a rejected account reads no result');
select is((public.my_member_access()->>'can_vote')::boolean, false, 'nor votes');

-- Approved resident without a room -------------------------------------------------
select pg_temp.act_as(:resid_d);
select is((select count(*)::int from public.result_snapshots where id = :snap), 1,
  'an approved resident reads a published result');
select is((public.my_member_access()->>'can_vote')::boolean, false,
  'a resident without a room has no Vote menu');
select is(public.verify_result_reference('50000000-0000-4000-8000-0000000000ff'), null,
  'an unknown reference returns nothing');

reset role;

select * from finish();
rollback;
