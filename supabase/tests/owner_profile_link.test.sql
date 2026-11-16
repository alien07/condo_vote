-- Database tests for D024 (0037): an owner of record is linked to one
-- account by id; rights follow the link, not the email.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

\set acc_a    '''00000000-0000-4000-8000-0000000000f1'''
\set acc_rej  '''00000000-0000-4000-8000-0000000000f2'''
\set acc_sh   '''00000000-0000-4000-8000-0000000000f3'''
\set acc_c    '''00000000-0000-4000-8000-0000000000f4'''
\set acc_new  '''00000000-0000-4000-8000-0000000000f5'''
\set staff    '''00000000-0000-4000-8000-0000000000f6'''
\set admin    '''00000000-0000-4000-8000-0000000000f7'''
\set own_a    '''60000000-0000-4000-8000-0000000000f1'''
\set own_rej  '''60000000-0000-4000-8000-0000000000f2'''
\set own_sh1  '''60000000-0000-4000-8000-0000000000f3'''
\set own_sh2  '''60000000-0000-4000-8000-0000000000f4'''
\set own_c    '''60000000-0000-4000-8000-0000000000f5'''
\set own_c2   '''60000000-0000-4000-8000-0000000000f6'''
\set room_a   '''40000000-0000-4000-8000-0000000000f1'''

update public.privacy_settings set consent_required = false;

insert into auth.users (id, email) values
  (:acc_a, 'link.a@example.test'),
  (:acc_rej, 'link.rejected@example.test'),
  (:acc_sh, 'link.shared@example.test'),
  (:acc_c, 'link.c@example.test'),
  (:acc_new, 'link.new@example.test'),
  (:staff, 'link.staff@example.test'),
  (:admin, 'link.admin@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:admin, :admin, 'Admin', 'link.admin@example.test', 'resident', 'approved'),
  (:acc_a, :acc_a, 'Account A', 'link.a@example.test', 'resident', 'pending'),
  (:acc_rej, :acc_rej, 'Rejected', 'link.rejected@example.test', 'resident', 'rejected'),
  (:acc_sh, :acc_sh, 'Shared', 'link.shared@example.test', 'resident', 'pending'),
  (:acc_c, :acc_c, 'Account C', 'link.c@example.test', 'resident', 'pending'),
  (:staff, :staff, 'Staff', 'link.staff@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:staff, 'staff'), (:admin, 'admin');
insert into public.rooms (id, room_number, ownership_percent) values (:room_a, 'L-101', 10);

-- Owner added for an account that already exists ---------------------------------
insert into public.owners (id, full_name, email) values (:own_a, 'Owner A', 'Link.A@example.test ');
insert into public.room_owners (room_id, owner_id, status) values (:room_a, :own_a, 'active');

select is((select profile_id from public.owners where id = :own_a), :acc_a::uuid,
  'a new owner is linked to the account with the same email (case and spaces ignored)');
select is((select approval_status || '/' || default_status from public.profiles where id = :acc_a),
  'approved/owner', 'and the account is approved as an owner');
select is((select count(*)::int from public.audit_logs
  where action = 'owner.profile_linked' and entity_id = :own_a), 1, 'and the link is audited');
select is(public.room_owner_profile_id(:room_a), :acc_a::uuid, 'the room votes through the link');

-- A rejected account is never linked or approved ------------------------------------
insert into public.owners (id, full_name, email) values (:own_rej, 'Owner R', 'link.rejected@example.test');
select is((select profile_id from public.owners where id = :own_rej), null, 'a rejected account is not linked');
select is((select approval_status from public.profiles where id = :acc_rej), 'rejected', 'and stays rejected');

-- Two active owners cannot share one email ------------------------------------------
insert into public.owners (id, full_name, email) values (:own_sh1, 'Owner S1', 'link.shared@example.test');
select throws_like(
  format($q$insert into public.owners (id, full_name, email) values (%L, 'Owner S2', ' LINK.shared@example.test')$q$, :own_sh2),
  '%owners_active_email_key%', 'a second active owner with the same email is refused (D024)');

-- An account linked to one owner is not linked to a second one ----------------------
insert into public.owners (id, full_name, email) values (:own_c, 'Owner C', 'link.c@example.test');
update public.owners set email = 'other.c@example.test' where id = :own_c;
insert into public.owners (id, full_name, email) values (:own_c2, 'Owner C2', 'link.c@example.test');
select is((select profile_id from public.owners where id = :own_c), :acc_c::uuid,
  'changing an owner email keeps the link');
select is((select profile_id from public.owners where id = :own_c2), null,
  'one account links to one owner only');

-- With consent required, the consent page links -----------------------------------
update public.privacy_settings set consent_required = true;
insert into public.owners (full_name, email) values ('Owner New', 'link.new@example.test');
insert into public.profiles (id, auth_user_id, full_name, email) values
  (:acc_new, :acc_new, 'New', 'link.new@example.test');
select is((select count(*)::int from public.owners where profile_id = :acc_new), 0,
  'no link before the privacy notice is accepted');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

select notice_version as nv from public.privacy_settings \gset

set local role authenticated;

select pg_temp.act_as(:acc_new);
select lives_ok(
  format('select public.accept_privacy_notice(%s)', :nv),
  'the account accepts the notice');
-- Owners are not readable by members (RLS); check as the test superuser.
reset role;
select is((select count(*)::int from public.owners where profile_id = :acc_new), 1,
  'accepting the notice links the owner');
set local role authenticated;
select pg_temp.act_as(:acc_new);
select is((public.my_member_access()->>'owns_room')::boolean, false,
  'owns_room follows room links of the linked owner (none here)');

-- Office staff cannot set the link by hand -------------------------------------------
select pg_temp.act_as(:staff);
select throws_like(
  format($q$update public.owners set profile_id = %L where id = %L$q$, :staff, :own_sh1),
  '%permission denied%', 'staff cannot write owners.profile_id');
select lives_ok(
  format($q$update public.owners set phone = '0800000000' where id = %L$q$, :own_sh1),
  'staff still edit the contact fields');
select throws_like(
  format($q$update public.owners set email = 'moved@example.test' where id = %L$q$, :own_sh1),
  '%OWNER_EMAIL_ADMIN_ONLY%', 'staff cannot change an owner email');

-- An admin can, and it is audited with masked addresses ---------------------------
select pg_temp.act_as(:admin);
select lives_ok(
  format($q$update public.owners set email = 'moved@example.test' where id = %L$q$, :own_sh1),
  'an admin changes an owner email');
reset role;
select is(
  (select details_json->>'from' || ' -> ' || (details_json->>'to') from public.audit_logs
   where action = 'owner.email_changed' and entity_id = :own_sh1),
  'l***@example.test -> m***@example.test', 'the change is audited with masked emails');

select * from finish();
rollback;
