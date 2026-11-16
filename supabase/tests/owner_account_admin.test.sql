-- Database tests for admin_set_owner_account (0038, D024): an admin links,
-- unlinks or moves an owner's account; open meetings follow, votes stay.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

\set acc_a   '''00000000-0000-4000-8000-0000000000a1'''
\set acc_b   '''00000000-0000-4000-8000-0000000000a2'''
\set acc_c   '''00000000-0000-4000-8000-0000000000a3'''
\set staff   '''00000000-0000-4000-8000-0000000000a4'''
\set admin   '''00000000-0000-4000-8000-0000000000a5'''
\set own_1   '''60000000-0000-4000-8000-0000000000a1'''
\set own_2   '''60000000-0000-4000-8000-0000000000a2'''
\set room_1  '''40000000-0000-4000-8000-0000000000a1'''
\set room_2  '''40000000-0000-4000-8000-0000000000a2'''
\set room_3  '''40000000-0000-4000-8000-0000000000a3'''
\set meet    '''10000000-0000-4000-8000-0000000000a1'''

update public.privacy_settings set consent_required = false;

insert into auth.users (id, email) values
  (:acc_a, 'acct.a@example.test'), (:acc_b, 'acct.b@example.test'),
  (:acc_c, 'acct.c@example.test'), (:staff, 'acct.staff@example.test'),
  (:admin, 'acct.admin@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:acc_a, :acc_a, 'A', 'acct.a@example.test', 'resident', 'pending'),
  (:acc_b, :acc_b, 'B', 'acct.b@example.test', 'resident', 'pending'),
  (:acc_c, :acc_c, 'C', 'acct.c@example.test', 'resident', 'pending'),
  (:staff, :staff, 'Staff', 'acct.staff@example.test', 'resident', 'approved'),
  (:admin, :admin, 'Admin', 'acct.admin@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:staff, 'staff'), (:admin, 'admin');

insert into public.rooms (id, room_number, ownership_percent) values
  (:room_1, 'AC-1', 10), (:room_2, 'AC-2', 10), (:room_3, 'AC-3', 10);
-- Owner 1 (linked to A by email) holds rooms 1 and 2; owner 2 (C) holds room 3.
insert into public.owners (id, full_name, email) values
  (:own_1, 'Owner 1', 'acct.a@example.test'),
  (:own_2, 'Owner 2', 'acct.c@example.test');
insert into public.room_owners (room_id, owner_id, status) values
  (:room_1, :own_1, 'active'), (:room_2, :own_1, 'active'), (:room_3, :own_2, 'active');

insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:meet, 'Open meeting', 'published', now() - interval '1 hour', now() + interval '1 day');
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source) values
  (:meet, :room_1, :acc_a, 'owner', 10, 'owner_master'),
  (:meet, :room_2, :acc_a, 'owner', 10, 'owner_master');
-- Room 2 already voted.
insert into public.ballots (meeting_id, room_id, voter_profile_id, status, submitted_at)
values (:meet, :room_2, :acc_a, 'submitted', now());

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Guards ---------------------------------------------------------------------------
select pg_temp.act_as(:staff);
select throws_like(
  format($q$select public.admin_set_owner_account(%L, 'acct.b@example.test', 'wrong email')$q$, :own_1),
  '%OWNER_ACCOUNT_ADMIN_ONLY%', 'office staff cannot change an owner account');

select pg_temp.act_as(:admin);
select throws_like(
  format($q$select public.admin_set_owner_account(%L, 'acct.b@example.test', 'no')$q$, :own_1),
  '%OWNER_ACCOUNT_REASON_REQUIRED%', 'a reason is required');
select throws_like(
  format($q$select public.admin_set_owner_account(%L, 'nobody@example.test', 'wrong email')$q$, :own_1),
  '%OWNER_ACCOUNT_PROFILE_NOT_FOUND%', 'the new account must exist');
select throws_like(
  format($q$select public.admin_set_owner_account(%L, 'acct.c@example.test', 'wrong email')$q$, :own_1),
  '%OWNER_ACCOUNT_PROFILE_TAKEN%', 'an account linked to another owner is refused');

-- Move A -> B ----------------------------------------------------------------------
select is(
  public.admin_set_owner_account(:own_1, ' ACCT.B@example.test', 'Lost Google account')->>'action',
  'owner.profile_moved', 'an admin moves the owner to another account');

reset role;
select is((select profile_id from public.owners where id = :own_1), :acc_b::uuid, 'the owner is linked to B');
select is((select approval_status || '/' || default_status from public.profiles where id = :acc_b),
  'approved/owner', 'B is approved as an owner');
select is((select default_status from public.profiles where id = :acc_a), 'resident', 'A is a resident again');
select is((select profile_id from public.eligible_voters_snapshot where meeting_id = :meet and room_id = :room_1),
  :acc_b::uuid, 'a room that has not voted moves to B in the open meeting');
select is((select profile_id from public.eligible_voters_snapshot where meeting_id = :meet and room_id = :room_2),
  :acc_a::uuid, 'a room that already voted keeps its voter');
select is((select details_json->>'reason' from public.audit_logs
  where action = 'owner.profile_moved' and entity_id = :own_1),
  'Lost Google account', 'the move is audited with the reason');

-- Unlink ----------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:admin);
select is(
  public.admin_set_owner_account(:own_1, null, 'Owner sold the rooms')->>'action',
  'owner.profile_unlinked', 'an admin unlinks the account');
reset role;
select is((select count(*)::int from public.eligible_voters_snapshot where meeting_id = :meet and room_id = :room_1),
  0, 'the unvoted room leaves the open meeting');
select is((select count(*)::int from public.eligible_voters_snapshot where meeting_id = :meet and room_id = :room_2),
  1, 'the voted room keeps its row');

-- Link an unlinked owner: a room with no row yet joins the open meeting -----------
set local role authenticated;
select pg_temp.act_as(:admin);
select is(
  public.admin_set_owner_account(:own_1, 'acct.a@example.test', 'Owner came back')->>'action',
  'owner.profile_linked', 'an admin links an unlinked owner');
reset role;
select is((select profile_id from public.eligible_voters_snapshot where meeting_id = :meet and room_id = :room_1),
  :acc_a::uuid, 'the room gets a row for the open meeting');

select * from finish();
rollback;
