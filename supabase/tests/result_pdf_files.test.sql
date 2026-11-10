-- Database tests for master PDF files of results (D021).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

\set owner_a '''00000000-0000-4000-8000-0000000000f1'''
\set admin_b '''00000000-0000-4000-8000-0000000000f2'''
\set meeting '''10000000-0000-4000-8000-0000000000f1'''
\set snap    '''50000000-0000-4000-8000-0000000000f1'''
\set draft_m '''10000000-0000-4000-8000-0000000000f2'''
\set draft_s '''50000000-0000-4000-8000-0000000000f2'''

insert into auth.users (id, email) values
  (:owner_a, 'pdf.owner@example.test'), (:admin_b, 'pdf.admin@example.test');
insert into public.profiles (id, auth_user_id, full_name, email, default_status, approval_status) values
  (:owner_a, :owner_a, 'Owner', 'pdf.owner@example.test', 'owner', 'approved'),
  (:admin_b, :admin_b, 'Admin', 'pdf.admin@example.test', 'resident', 'approved');
insert into public.app_roles (profile_id, role) values (:admin_b, 'admin');
insert into public.meetings (id, title, status, starts_at, ends_at) values
  (:meeting, 'Published', 'closed', now() - interval '2 days', now() - interval '1 day'),
  (:draft_m, 'Not published', 'closed', now() - interval '2 days', now() - interval '1 day');
insert into public.result_snapshots (id, meeting_id, payload_json) values
  (:snap, :meeting, '{}'), (:draft_s, :draft_m, '{}');
insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count)
values (:meeting, :snap, 1);

create function pg_temp.act_as(profile uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', profile, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as(:admin_b);

select lives_ok(
  format($q$insert into public.result_documents (result_snapshot_id, kind, language, storage_path, sha256, byte_size) values
    (%L, 'official', 'th', %L, repeat('a', 64), 10),
    (%L, 'summary', 'en', %L, repeat('b', 64), 10)$q$,
    :snap, :snap || '/official-th.pdf', :snap, :snap || '/summary-en.pdf'),
  'admin records the files of a published result');

select throws_like(
  format($q$insert into public.result_documents (result_snapshot_id, kind, language, storage_path, sha256, byte_size)
    values (%L, 'summary', 'th', %L, repeat('c', 64), 10)$q$, :draft_s, :draft_s || '/summary-th.pdf'),
  '%row-level security%', 'no files for an unpublished result');

select throws_like(
  format($q$insert into public.result_documents (result_snapshot_id, kind, language, storage_path, sha256, byte_size)
    values (%L, 'official', 'en', %L, repeat('d', 64), 10)$q$, :snap, :snap || '/official-en.pdf'),
  '%result_documents_official_thai%', 'the official record is Thai only');

select is((select count(*)::int from public.result_documents where result_snapshot_id = :snap), 2,
  'admin sees every file');

select pg_temp.act_as(:owner_a);

select is(
  (select array_agg(kind order by kind) from public.result_documents where result_snapshot_id = :snap),
  array['summary'], 'owners see only summaries');

select throws_like(
  format($q$insert into public.result_documents (result_snapshot_id, kind, language, storage_path, sha256, byte_size)
    values (%L, 'summary', 'th', %L, repeat('e', 64), 10)$q$, :snap, :snap || '/summary-th.pdf'),
  '%row-level security%', 'owners cannot record files');

reset role;

-- Storage object rules use the same split: "<snapshot>/<kind>-<language>.pdf".
insert into storage.objects (bucket_id, name) values
  ('result-documents', :snap || '/official-th.pdf'),
  ('result-documents', :snap || '/summary-en.pdf');

set local role authenticated;
select pg_temp.act_as(:owner_a);

select is(
  (select array_agg(name order by name) from storage.objects
   where bucket_id = 'result-documents' and name like :snap || '/%'),
  array[:snap || '/summary-en.pdf'], 'owners can read only summary files');

select pg_temp.act_as(:admin_b);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'result-documents' and name like :snap || '/%'),
  2, 'admin can read every file');

select * from finish();
rollback;
