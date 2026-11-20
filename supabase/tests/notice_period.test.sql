-- Strict notice period (req_0011 C, D027; Condominium Act s.42/3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

\set sys     '''00000000-0000-4000-8000-0000000003a1'''
\set manager '''00000000-0000-4000-8000-0000000003a2'''
\set soon    '''10000000-0000-4000-8000-0000000003a1'''
\set later   '''10000000-0000-4000-8000-0000000003a2'''

insert into auth.users (id, email) values (:sys, 'np.sys@example.test'), (:manager, 'np.manager@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:sys, :sys, 'NP Sys', 'np.sys@example.test', 'proxy', 'approved'),
  (:manager, :manager, 'NP Manager', 'np.manager@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:sys, 'system_admin'), (:manager, 'admin');
insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:soon, 'Soon', 'draft', now() + interval '3 days', now() + interval '3 days 4 hours'),
  (:later, 'Later', 'draft', now() + interval '10 days', now() + interval '10 days 4 hours');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

select is(public.notice_period_days(), 7, 'seven days, one constant');

select pg_temp.act_as(:manager);
set local role authenticated;
select is((public.meeting_notice_check(:soon)->>'short')::boolean, true, 'three days away is short');
select is((public.meeting_notice_check(:later)->>'short')::boolean, false, 'ten days away is not');
select throws_like($q$select public.set_strict_notice_period(true)$q$, 'SYSTEM_FORBIDDEN%', 'only a system admin sets it');

-- Off (default): publishing a short notice works (the app warns first).
select lives_ok(format($q$update public.meetings set status = 'published', published_at = now() where id = %L$q$, :soon),
  'not strict: a short notice can be published');
update public.meetings set status = 'draft', published_at = null where id = :soon;

select pg_temp.act_as(:sys);
select lives_ok($q$select public.set_strict_notice_period(true)$q$, 'the system admin turns strict on');

select pg_temp.act_as(:manager);
select throws_like(format($q$update public.meetings set status = 'published', published_at = now() where id = %L$q$, :soon),
  'MEETING_NOTICE_TOO_SHORT%', 'strict: a short notice is refused');
select lives_ok(format($q$update public.meetings set status = 'published', published_at = now() where id = %L$q$, :later),
  'strict: seven days or more is fine');
reset role;

select ok(exists (select 1 from public.audit_logs where action = 'app_settings.strict_notice_changed' and actor_profile_id = :sys),
  'changing the setting is audited');

select * from finish();
rollback;
