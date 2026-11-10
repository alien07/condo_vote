-- Database tests for owner language (D020).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set user_a '''00000000-0000-4000-8000-0000000000e1'''
\set user_b '''00000000-0000-4000-8000-0000000000e2'''

insert into auth.users (id, email) values
  (:user_a, 'lang.a@example.test'), (:user_b, 'lang.b@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:user_a, :user_a, 'Lang A', 'lang.a@example.test', 'owner', 'approved'),
  (:user_b, :user_b, 'Lang B', 'lang.b@example.test', 'owner', 'approved');

select is((select preferred_language from public.profiles where id = :user_a), 'th',
  'new profiles default to Thai');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as(:user_a);

select lives_ok($q$select public.set_preferred_language('en')$q$, 'a user sets their own language');
select throws_like($q$select public.set_preferred_language('fr')$q$, '%INVALID_LANGUAGE%',
  'only Thai and English are allowed');

reset role;

select is((select preferred_language from public.profiles where id = :user_a), 'en',
  'the language is saved on the caller''s profile');
select is((select preferred_language from public.profiles where id = :user_b), 'th',
  'other profiles are not changed');

insert into public.email_logs (recipient_email, template_key, status)
values ('nobody@example.test', 'vote_fyi:test', 'queued');
select is((select language from public.email_logs where recipient_email = 'nobody@example.test'), 'th',
  'emails default to Thai');

create temp table notice_before as select notice_version from public.privacy_settings;
update public.privacy_settings set notice_text_en = 'New English notice';
select is(
  (select notice_version from public.privacy_settings) - (select notice_version from notice_before),
  1, 'changing the English notice starts a new version');

select * from finish();
rollback;
