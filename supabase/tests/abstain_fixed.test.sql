-- Abstain is a fixed choice, added only when the agenda item has it (0041).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

\set admin    '''00000000-0000-4000-8000-0000000000a7'''
\set draft    '''10000000-0000-4000-8000-0000000000a7'''
\set q_one    '''20000000-0000-4000-8000-0000000000a7'''
\set q_two    '''20000000-0000-4000-8000-0000000000a8'''

insert into auth.users (id, email) values (:admin, 'admin.abstain@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status)
values (:admin, :admin, 'Admin Abstain', 'admin.abstain@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin, 'admin');
insert into public.meetings (id, title, status, starts_at, ends_at)
values (:draft, 'Abstain draft', 'draft', now() + interval '1 day', now() + interval '2 days');
insert into public.meeting_questions (id, meeting_id, question_text, display_order) values
  (:q_one, :draft, 'Item one', 1),
  (:q_two, :draft, 'Item two', 2);

select is(
  (select count(*)::int from public.meeting_choices where question_id = :q_one),
  0, 'a new agenda item has no Abstain choice');

-- The database owner (seed) gets the fixed text.
insert into public.meeting_choices (question_id, choice_text, display_order, is_abstain)
values (:q_one, 'Cat', 3, true);

select results_eq(
  format($q$select choice_text, choice_text_en, display_order from public.meeting_choices where question_id = %L and is_abstain$q$, :q_one),
  $$values ('Abstain'::text, 'Abstain'::text, 999)$$,
  'Abstain always has the fixed text and comes last');

select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_like(
  format($q$update public.meeting_choices set choice_text = 'Cat' where question_id = %L and is_abstain$q$, :q_one),
  'ABSTAIN_FIXED%', 'the app cannot rename Abstain');

select throws_like(
  format($q$update public.meeting_choices set is_abstain = false where question_id = %L and is_abstain$q$, :q_one),
  'ABSTAIN_FIXED%', 'the app cannot turn Abstain into a normal choice');

select lives_ok(
  format($q$insert into public.meeting_choices (question_id, choice_text, display_order, is_abstain) values (%L, 'Dog', 1, true)$q$, :q_two),
  'the app adds Abstain to a draft agenda item');

select results_eq(
  format($q$select choice_text from public.meeting_choices where question_id = %L and is_abstain$q$, :q_two),
  $$values ('Abstain'::text)$$,
  'an added Abstain gets the fixed text');

select lives_ok(
  format($q$delete from public.meeting_choices where question_id = %L and is_abstain$q$, :q_two),
  'the app removes Abstain from a draft agenda item');

select * from finish();
rollback;
