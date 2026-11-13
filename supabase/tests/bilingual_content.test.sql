-- Database tests for English meeting text (0032).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set admin_a '''00000000-0000-4000-8000-0000000000c1'''
\set owner_b '''00000000-0000-4000-8000-0000000000c2'''
\set meet    '''10000000-0000-4000-8000-0000000000c1'''
\set q1      '''20000000-0000-4000-8000-0000000000c1'''
\set c1      '''30000000-0000-4000-8000-0000000000c1'''

insert into auth.users (id, email) values (:admin_a, 'en.admin@example.test'), (:owner_b, 'en.owner@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:admin_a, :admin_a, 'Admin A', 'en.admin@example.test', 'resident', 'approved'),
  (:owner_b, :owner_b, 'Owner B', 'en.owner@example.test', 'owner', 'approved');
insert into public.app_roles (profile_id, role) values (:admin_a, 'admin');
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:meet, 'ประชุม', 'draft', now() + interval '1 day', now() + interval '2 days');
insert into public.meeting_questions (id, meeting_id, question_text, question_type, required, display_order)
values (:q1, :meet, 'อนุมัติงบ', 'single_choice', true, 1);
insert into public.meeting_choices (id, question_id, choice_text, display_order) values (:c1, :q1, 'เห็นด้วย', 1);

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.act_as(:owner_b);
select throws_like(
  format($q$select public.save_meeting_english(%L, '{}'::jsonb, false)$q$, :meet),
  'MEETING_FORBIDDEN%', 'only admins edit meeting text');

select pg_temp.act_as(:admin_a);
select is(
  (public.save_meeting_english(:meet, jsonb_build_object(
    'meeting', jsonb_build_object('title_en', 'Meeting'),
    'questions', jsonb_build_array(jsonb_build_object('id', :q1, 'question_text_en', 'Approve the budget')),
    'choices', jsonb_build_array(jsonb_build_object('id', :c1, 'choice_text_en', 'Approve'))
  ), true)->>'changed_rows')::int,
  3, 'English is saved for the meeting, the question and the choice');

reset role;
select ok((select english_checked_at is not null from public.meetings where id = :meet), 'checked is recorded');
select is((select question_text from public.meeting_questions where id = :q1), 'อนุมัติงบ', 'Thai is untouched');

update public.meetings set status = 'published' where id = :meet;
set local role authenticated;
select pg_temp.act_as(:admin_a);
select lives_ok(
  format($q$select public.save_meeting_english(%L, jsonb_build_object('meeting', jsonb_build_object('title_en', 'Annual meeting')), false)$q$, :meet),
  'English can change after publishing');

reset role;
select ok((select english_checked_at is null from public.meetings where id = :meet), 'a change clears "checked"');
select ok(exists (select 1 from public.audit_logs where entity_id = :meet and action = 'meeting.english_edited_after_publish'),
  'an edit after publishing is audited');

select * from finish();
rollback;
