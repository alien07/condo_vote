-- Database tests for ballot secrecy and online result totals (D015).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

\set owner_a  '''00000000-0000-4000-8000-0000000000e1'''
\set owner_b  '''00000000-0000-4000-8000-0000000000e2'''
\set admin_c  '''00000000-0000-4000-8000-0000000000e3'''
\set room_a   '''40000000-0000-4000-8000-0000000000e1'''
\set room_b   '''40000000-0000-4000-8000-0000000000e2'''
\set open_m   '''10000000-0000-4000-8000-0000000000e1'''
\set secret_m '''10000000-0000-4000-8000-0000000000e2'''
\set draft_m  '''10000000-0000-4000-8000-0000000000e3'''
\set q_open   '''20000000-0000-4000-8000-0000000000e1'''
\set q_secret '''20000000-0000-4000-8000-0000000000e2'''
\set open_yes '''30000000-0000-4000-8000-0000000000e1'''
\set open_no  '''30000000-0000-4000-8000-0000000000e2'''
\set sec_yes  '''30000000-0000-4000-8000-0000000000e3'''
\set sec_no   '''30000000-0000-4000-8000-0000000000e4'''

insert into auth.users (id, email) values
  (:owner_a, 'secret.a@example.test'), (:owner_b, 'secret.b@example.test'),
  (:admin_c, 'secret.admin@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:owner_a, :owner_a, 'Owner A', 'secret.a@example.test', 'owner', 'approved'),
  (:owner_b, :owner_b, 'Owner B', 'secret.b@example.test', 'owner', 'approved'),
  (:admin_c, :admin_c, 'Admin C', 'secret.admin@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin_c, 'admin');
insert into public.rooms (id, room_number, ownership_percent) values
  (:room_a, 'S-101', 10), (:room_b, 'S-102', 30);

insert into public.meetings (id, title, status, starts_at, ends_at, ballot_secrecy) values
  (:open_m, 'Open ballot meeting', 'published', now() - interval '1 hour', now() + interval '1 hour', 'open'),
  (:secret_m, 'Secret ballot meeting', 'published', now() - interval '1 hour', now() + interval '1 hour', 'secret'),
  (:draft_m, 'Draft meeting', 'draft', now() + interval '1 day', now() + interval '2 days', 'open');
insert into public.meeting_questions (id, meeting_id, question_text, question_type, required, display_order) values
  (:q_open, :open_m, 'Open question', 'single_choice', true, 1),
  (:q_secret, :secret_m, 'Secret question', 'single_choice', true, 1);
insert into public.meeting_choices (id, question_id, choice_text, display_order) values
  (:open_yes, :q_open, 'Yes', 1), (:open_no, :q_open, 'No', 2),
  (:sec_yes, :q_secret, 'Yes', 1), (:sec_no, :q_secret, 'No', 2);
insert into public.eligible_voters_snapshot (meeting_id, room_id, profile_id, voter_type, ownership_percent, source) values
  (:open_m, :room_a, :owner_a, 'owner', 10, 'owner_master'),
  (:open_m, :room_b, :owner_b, 'owner', 30, 'owner_master'),
  (:secret_m, :room_a, :owner_a, 'owner', 10, 'owner_master'),
  (:secret_m, :room_b, :owner_b, 'owner', 30, 'owner_master');

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.vote(meeting uuid, room uuid, question uuid, choice uuid) returns void language sql as $$
  select public.submit_ballot(meeting, room, jsonb_build_array(
    jsonb_build_object('question_id', question, 'choice_ids', jsonb_build_array(choice))));
$$;

set local role authenticated;
select pg_temp.act_as(:owner_a);
select pg_temp.vote(:open_m, :room_a, :q_open, :open_yes);
select pg_temp.vote(:secret_m, :room_a, :q_secret, :sec_yes);
select pg_temp.act_as(:owner_b);
select pg_temp.vote(:open_m, :room_b, :q_open, :open_no);
select pg_temp.vote(:secret_m, :room_b, :q_secret, :sec_no);

select is(
  (select count(*)::int from public.ballot_answers where choice_id = :sec_no),
  1, 'a voter still sees their own secret ballot answer');

select pg_temp.act_as(:admin_c);

select is(
  (select count(*)::int from public.ballots where meeting_id = :secret_m),
  2, 'admin sees which rooms voted in a secret meeting');

select is(
  (select count(*)::int from public.ballot_answers where choice_id in (:sec_yes, :sec_no)),
  0, 'admin cannot read secret ballot answers');

select is(
  (select count(*)::int from public.ballot_answers where choice_id in (:open_yes, :open_no)),
  2, 'admin can read open ballot answers');

select is(
  (select ownership from public.meeting_online_tally(:secret_m) where choice_id = :sec_no),
  30::numeric, 'secret meeting totals weigh votes by ownership');

select is(
  (select vote_count from public.meeting_online_tally(:secret_m) where choice_id = :sec_yes),
  1, 'secret meeting totals count votes');

select pg_temp.act_as(:owner_a);

select throws_like(format($q$select * from public.meeting_online_tally(%L)$q$, :secret_m),
  'RESULT_FORBIDDEN%', 'only admins can read online totals');

reset role;

-- A manual ballot for room B without a resolution replaces the online one.
insert into public.manual_ballots (meeting_id, room_id, imported_by, status, identity_status)
values (:open_m, :room_b, :admin_c, 'submitted', 'linked');

select pg_temp.act_as(:admin_c);
set local role authenticated;

select is(
  (select count(*)::int from public.meeting_online_tally(:open_m) where choice_id = :open_no),
  0, 'an online ballot replaced by a manual ballot is not counted');

select is(
  (select ownership from public.meeting_online_tally(:open_m) where choice_id = :open_yes),
  10::numeric, 'other online ballots still count');

reset role;

select throws_like(
  format($q$update public.meetings set ballot_secrecy = 'open' where id = %L$q$, :secret_m),
  'VOTE_SECRECY_LOCKED%', 'secrecy cannot change after publishing');

update public.meetings set ballot_secrecy = 'secret' where id = :draft_m;
select is(
  (select ballot_secrecy from public.meetings where id = :draft_m),
  'secret', 'secrecy can change while draft');

select * from finish();
rollback;
