-- D021: master PDF files of the result documents, generated once when the
-- result is published and kept in private Supabase Storage.

insert into storage.buckets (id, name, public)
values ('result-documents', 'result-documents', false)
on conflict (id) do nothing;

create table public.result_documents (
  id uuid primary key default gen_random_uuid(),
  result_snapshot_id uuid not null references public.result_snapshots(id),
  kind text not null constraint result_documents_kind_check check (kind in ('official', 'summary')),
  language text not null constraint result_documents_language_check check (language in ('th', 'en')),
  storage_path text not null unique,
  sha256 text not null constraint result_documents_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size > 0),
  created_by uuid references public.profiles(id) default public.current_profile_id(),
  created_at timestamptz not null default now(),
  unique (result_snapshot_id, kind, language),
  -- The official record is Thai only.
  constraint result_documents_official_thai check (kind <> 'official' or language = 'th')
);

comment on table public.result_documents is
  'Master PDF files of published results (D021). Files live in the result-documents bucket.';

alter table public.result_documents enable row level security;

-- Files are made only for published results, by admins or committee members.
create policy "result_documents_committee_insert"
on public.result_documents
for insert
to authenticated
with check (
  public.can_approve_as_committee()
  and exists (
    select 1 from public.result_publications p
    where p.result_snapshot_id = result_documents.result_snapshot_id
  )
);

-- Admin and committee see every file; other signed-in users see summaries of
-- published results.
create policy "result_documents_select"
on public.result_documents
for select
to authenticated
using (
  public.can_approve_as_committee()
  or (
    kind = 'summary'
    and exists (
      select 1 from public.result_publications p
      where p.result_snapshot_id = result_documents.result_snapshot_id
    )
  )
);

-- Storage paths are "<snapshot id>/<kind>-<language>.pdf".
create policy "result_documents_files_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'result-documents'
  and public.can_approve_as_committee()
  and exists (
    select 1 from public.result_publications p
    where p.result_snapshot_id::text = split_part(name, '/', 1)
  )
);

-- Overwrite only a file left over from a failed try (no result_documents row).
create policy "result_documents_files_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'result-documents'
  and public.can_approve_as_committee()
  and not exists (
    select 1 from public.result_documents d where d.storage_path = name
  )
)
with check (bucket_id = 'result-documents' and public.can_approve_as_committee());

create policy "result_documents_files_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'result-documents'
  and (
    public.can_approve_as_committee()
    or (
      split_part(name, '/', 2) like 'summary-%'
      and exists (
        select 1 from public.result_publications p
        where p.result_snapshot_id::text = split_part(name, '/', 1)
      )
    )
  )
);

-- Result-approved emails go out in each recipient's language (D020).
create or replace function public.queue_result_approved_emails(p_meeting_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with recipients as (
    select lower(btrim(email)) as email, created_at as active_at
    from public.owners
    where active and email is not null and btrim(email) <> ''
    union all
    select lower(btrim(email)), created_at
    from public.profiles
    where approval_status = 'approved' and default_status = 'resident'
  ),
  latest as (
    select email, max(active_at) as active_at
    from recipients
    group by email
  )
  insert into public.email_logs (recipient_email, template_key, status, language)
  select l.email, 'result_approved:' || p_meeting_id, 'queued',
    coalesce(
      (select p.preferred_language from public.profiles p
       where lower(p.email) = l.email
       order by p.created_at desc
       limit 1),
      'th'
    )
  from latest l
  where not exists (
    select 1 from public.email_logs e
    where e.template_key = 'result_approved:' || p_meeting_id
      and lower(e.recipient_email) = l.email
  )
  order by l.active_at desc;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.queue_result_approved_emails(uuid) from public;
