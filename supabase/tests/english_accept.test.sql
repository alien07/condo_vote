-- Keep the English of a published meeting as it is (0050, D020).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set manager '''00000000-0000-4000-8000-0000000004a1'''
\set staff   '''00000000-0000-4000-8000-0000000004a2'''
\set pub     '''10000000-0000-4000-8000-0000000004a1'''
\set draft   '''10000000-0000-4000-8000-0000000004a2'''

insert into auth.users (id, email) values (:manager, 'ea.manager@example.test'), (:staff, 'ea.staff@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:manager, :manager, 'EA Manager', 'ea.manager@example.test', 'resident', 'approved'),
  (:staff, :staff, 'EA Staff', 'ea.staff@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:manager, 'admin'), (:staff, 'staff');
insert into public.meetings (id, title, title_en, status, starts_at, ends_at) values
  (:pub, 'ประชุม', null, 'published', now() - interval '1 hour', now() + interval '1 day'),
  (:draft, 'ร่าง', null, 'draft', now() + interval '9 days', now() + interval '10 days');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as(:staff);
select throws_like(format($q$select public.accept_meeting_english_as_is(%L)$q$, :pub),
  'MEETING_FORBIDDEN%', 'office staff cannot decide');

select pg_temp.act_as(:manager);
select throws_like(format($q$select public.accept_meeting_english_as_is(%L)$q$, :draft),
  'MEETING_NOT_PUBLISHED%', 'a draft is checked before publishing instead');
select lives_ok(format($q$select public.accept_meeting_english_as_is(%L)$q$, :pub), 'the Manager keeps it as it is');
reset role;

select isnt((select english_checked_at from public.meetings where id = :pub), null, 'the meeting counts as checked');
select is((select english_checked_by from public.meetings where id = :pub), :manager::uuid, 'who decided is kept');
select is((select title_en from public.meetings where id = :pub), null, 'no text is changed: readers see the Thai title');
select is((select (details_json->>'missing_english')::int from public.audit_logs
           where action = 'meeting.english_kept_as_is' and entity_id = :pub), 1, 'the audit row counts the texts without English');

select * from finish();
rollback;
