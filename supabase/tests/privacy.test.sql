-- Database tests for the system_admin role and PDPA consent (D016).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

\set user_a  '''00000000-0000-4000-8000-0000000000c7'''
\set admin_b '''00000000-0000-4000-8000-0000000000c8'''
\set sys_c   '''00000000-0000-4000-8000-0000000000c9'''

insert into auth.users (id, email) values
  (:user_a, 'privacy.a@example.test'), (:admin_b, 'privacy.admin@example.test'),
  (:sys_c, 'privacy.sys@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:user_a, :user_a, 'User A', 'privacy.a@example.test', 'resident', 'approved'),
  (:admin_b, :admin_b, 'Admin B', 'privacy.admin@example.test', 'resident', 'approved'),
  (:sys_c, :sys_c, 'System C', 'privacy.sys@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin_b, 'admin'), (:sys_c, 'system_admin');

update public.privacy_settings set consent_required = true;

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as(:user_a);

select ok(public.needs_privacy_consent(), 'a new user must accept the notice');

select throws_like('select public.accept_privacy_notice(999)',
  'PRIVACY_NOTICE_CHANGED%', 'accepting an old or wrong version fails');

select lives_ok(
  format('select public.accept_privacy_notice(%s)', (select notice_version from public.privacy_settings)),
  'user accepts the current notice');

select ok(not public.needs_privacy_consent(), 'no consent needed after accepting');

-- Meeting admin cannot change technical settings or grant system_admin.
select pg_temp.act_as(:admin_b);

update public.privacy_settings set notice_text = 'Admin edit';
select is((select notice_text from public.privacy_settings) = 'Admin edit', false,
  'a meeting admin cannot change the privacy notice');

select throws_like(
  format($q$insert into public.app_roles (profile_id, role) values (%L, 'system_admin')$q$, :user_a),
  '%row-level security%', 'a meeting admin cannot grant system_admin');

select lives_ok(
  format($q$insert into public.app_roles (profile_id, role) values (%L, 'committee')$q$, :user_a),
  'a meeting admin can still grant committee');

select throws_like(
  $q$insert into public.app_settings (document_storage_provider) values ('local_drive')$q$,
  '%row-level security%', 'a meeting admin cannot change storage settings');

-- System admin changes the notice: new version, everyone accepts again.
select pg_temp.act_as(:sys_c);

update public.privacy_settings set notice_text = 'Updated notice', retention_months_vote_records = 60;
select is((select notice_text from public.privacy_settings), 'Updated notice',
  'system admin can change the privacy notice');

select pg_temp.act_as(:user_a);

select ok(public.needs_privacy_consent(), 'a new notice version needs consent again');

select pg_temp.act_as(:sys_c);

select lives_ok(
  $q$insert into public.app_settings (document_storage_provider) values ('google_drive')$q$,
  'system admin can change storage settings');

reset role;

select is((select count(*)::int from public.audit_logs
  where action = 'privacy.accepted' and actor_profile_id = :user_a), 1,
  'consent is recorded in the audit log');

select * from finish();
rollback;
