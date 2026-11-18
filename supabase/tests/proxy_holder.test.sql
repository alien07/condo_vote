-- Who cannot hold a proxy (Condominium Act section 47, 0043).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set outsider '''00000000-0000-4000-8000-0000000004a1'''
\set member   '''00000000-0000-4000-8000-0000000004a2'''
\set office   '''00000000-0000-4000-8000-0000000004a3'''
\set former   '''00000000-0000-4000-8000-0000000004a4'''
\set meeting  '''10000000-0000-4000-8000-0000000004a1'''
\set room1    '''40000000-0000-4000-8000-0000000004a1'''
\set room2    '''40000000-0000-4000-8000-0000000004a2'''

insert into auth.users (id, email) values
  (:outsider, 'outsider.proxy@example.test'),
  (:member, 'member.proxy@example.test'),
  (:office, 'office.proxy@example.test'),
  (:former, 'former.proxy@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:outsider, :outsider, 'Outsider', 'outsider.proxy@example.test', 'proxy', 'approved'),
  (:member, :member, 'Member', 'member.proxy@example.test', 'owner', 'approved'),
  (:office, :office, 'Office', 'office.proxy@example.test', 'resident', 'approved'),
  (:former, :former, 'Former member', 'former.proxy@example.test', 'owner', 'approved');
insert into public.committee_members (full_name, position_title, profile_id, active, term_ends_at) values
  ('Member', 'กรรมการ', :member, true, null),
  ('Former member', 'กรรมการ', :former, true, current_date - 1);
insert into public.app_roles (profile_id, role) values (:office, 'staff');
insert into public.rooms (id, room_number, ownership_percent) values
  (:room1, 'P-47-1', 1), (:room2, 'P-47-2', 1);
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:meeting, 'Section 47 meeting', 'draft', now() + interval '1 day', now() + interval '2 days');

select lives_ok(
  format($q$insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id) values (%L, %L, %L)$q$, :meeting, :room1, :outsider),
  'someone from outside the condo can hold a proxy');

select throws_like(
  format($q$insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id) values (%L, %L, %L)$q$, :meeting, :room2, :member),
  'VOTE_PROXY_NOT_ALLOWED%committee%', 'a committee member cannot hold a proxy');

select throws_like(
  format($q$insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id) values (%L, %L, %L)$q$, :meeting, :room2, :office),
  'VOTE_PROXY_NOT_ALLOWED%office staff%', 'juristic office staff cannot hold a proxy');

select lives_ok(
  format($q$insert into public.proxy_authorizations (meeting_id, room_id, proxy_profile_id) values (%L, %L, %L)$q$, :meeting, :room2, :former),
  'a committee member whose term ended can hold a proxy');

select throws_like(
  format($q$update public.proxy_authorizations set proxy_profile_id = %L where room_id = %L$q$, :member, :room1),
  'VOTE_PROXY_NOT_ALLOWED%', 'a proxy cannot be moved to a committee member');

-- A holder who joins the committee later cannot be approved.
insert into public.app_roles (profile_id, role) values (:outsider, 'committee');

select throws_like(
  format($q$update public.proxy_authorizations set status = 'approved' where room_id = %L$q$, :room1),
  'VOTE_PROXY_NOT_ALLOWED%', 'a holder who became a committee member cannot be approved');

select lives_ok(
  format($q$update public.proxy_authorizations set status = 'revoked' where room_id = %L$q$, :room1),
  'that proxy can still be revoked');

select * from finish();
rollback;
