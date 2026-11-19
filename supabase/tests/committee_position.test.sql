-- Built-in committee positions (D026, migration 0045).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

\set member_a '''00000000-0000-4000-8000-0000000005a1'''

insert into auth.users (id, email) values (:member_a, 'position.a@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:member_a, :member_a, 'Position A', 'position.a@example.test', 'owner', 'approved');

-- Backfill mapping: Thai and English titles of a built-in position get its code.
select is(public.committee_position_code_for('Chairperson'), 'chair', 'Chairperson is chair');
select is(public.committee_position_code_for('ประธานกรรมการ'), 'chair', 'ประธานกรรมการ is chair');
select is(public.committee_position_code_for('  vice   chairperson '), 'vice_chair', 'spaces and case do not matter');
select is(public.committee_position_code_for('รองประธานกรรมการ'), 'vice_chair', 'รองประธานกรรมการ is vice chair');
select is(public.committee_position_code_for('เลขานุการ'), 'secretary', 'เลขานุการ is secretary');
select is(public.committee_position_code_for('Treasurer'), 'treasurer', 'Treasurer is treasurer');
select is(public.committee_position_code_for('กรรมการ'), 'member', 'กรรมการ is member');
select is(public.committee_position_code_for('Committee member'), 'member', 'Committee member is member');
select is(public.committee_position_code_for('ฝ่ายอาคาร'), 'other', 'an unknown title becomes other');

-- Constraint: seven codes; 'other' needs a typed title, a built-in code has none.
select lives_ok(
  $q$insert into public.committee_members (full_name, position_code) values ('Default member', 'member')$q$,
  'a built-in position needs no title');
select is(
  (select position_code from public.committee_members where full_name = 'Default member'),
  'member', 'member is the default code');
select throws_ok(
  $q$insert into public.committee_members (full_name, position_code) values ('Bad code', 'auditor')$q$,
  '23514', null, 'an unknown code is rejected');
select throws_ok(
  $q$insert into public.committee_members (full_name, position_code) values ('No title', 'other')$q$,
  '23514', null, 'other without a typed title is rejected');
select throws_ok(
  $q$insert into public.committee_members (full_name, position_code, position_title) values ('Both', 'chair', 'Chairperson')$q$,
  '23514', null, 'a built-in position does not keep a typed title');
select lives_ok(
  $q$insert into public.committee_members (profile_id, full_name, position_code, position_title) values ('00000000-0000-4000-8000-0000000005a1', 'Typed', 'other', 'ฝ่ายอาคาร')$q$,
  'other keeps its typed title');

-- Labels for documents and the committee pages.
select is(public.committee_position_label('vice_chair', null, 'en'), 'Vice chairperson', 'English label from the code');
select is(
  public.committee_people(array[:member_a]::uuid[]) -> 0 ->> 'position',
  'ฝ่ายอาคาร', 'committee_people shows the typed title for other');

select * from finish();
rollback;
