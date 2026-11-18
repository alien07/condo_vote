-- Agenda items and choices change only while the meeting is a draft (0039).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

\set admin    '''00000000-0000-4000-8000-0000000000f1'''
\set draft    '''10000000-0000-4000-8000-0000000000f1'''
\set pub      '''10000000-0000-4000-8000-0000000000f2'''
\set q_draft  '''20000000-0000-4000-8000-0000000000f1'''
\set q_pub    '''20000000-0000-4000-8000-0000000000f2'''

insert into auth.users (id, email) values (:admin, 'admin.lock@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status)
values (:admin, :admin, 'Admin Lock', 'admin.lock@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin, 'admin');
insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:draft, 'Draft meeting', 'draft', now() + interval '1 day', now() + interval '2 days'),
  (:pub, 'Published meeting', 'published', now() - interval '1 hour', now() + interval '1 hour');
-- Set up as the database owner (like the demo seed): not checked.
insert into public.meeting_questions (id, meeting_id, question_text, display_order) values
  (:q_draft, :draft, 'Draft question', 1),
  (:q_pub, :pub, 'Published question', 1);
insert into public.meeting_choices (question_id, choice_text, display_order) values
  (:q_pub, 'Agree', 1);

select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  format($q$update public.meeting_questions set question_text = 'Draft question edited' where id = %L$q$, :q_draft),
  'a draft meeting''s agenda item can be edited');

select lives_ok(
  format($q$insert into public.meeting_choices (question_id, choice_text, display_order) values (%L, 'Agree', 1)$q$, :q_draft),
  'a draft meeting''s agenda item gets a new choice');

select throws_like(
  format($q$update public.meeting_questions set question_text = 'Changed after publish' where id = %L$q$, :q_pub),
  'AGENDA_LOCKED%', 'a published meeting''s agenda item cannot be edited');

select throws_like(
  format($q$insert into public.meeting_questions (meeting_id, question_text, display_order) values (%L, 'New item', 2)$q$, :pub),
  'AGENDA_LOCKED%', 'a published meeting cannot get a new agenda item');

select throws_like(
  format($q$insert into public.meeting_choices (question_id, choice_text, display_order) values (%L, 'Disagree', 2)$q$, :q_pub),
  'AGENDA_LOCKED%', 'a published meeting''s agenda item cannot get a new choice');

select throws_like(
  format($q$delete from public.meeting_choices where question_id = %L and not is_abstain$q$, :q_pub),
  'AGENDA_LOCKED%', 'a published meeting''s choice cannot be deleted');

select throws_like(
  format($q$update public.meeting_questions set meeting_id = %L where id = %L$q$, :pub, :q_draft),
  'AGENDA_LOCKED%', 'an agenda item cannot be moved into a published meeting');

select lives_ok(
  format($q$update public.meeting_questions set question_text_en = 'Published question (EN)' where id = %L$q$, :q_pub),
  'English text of a published agenda item can still change');

select lives_ok(
  format($q$update public.meeting_choices set choice_text_en = 'Agree' where question_id = %L and not is_abstain$q$, :q_pub),
  'English text of a published choice can still change');

select * from finish();
rollback;
