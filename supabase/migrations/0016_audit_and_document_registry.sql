-- Business audit log and configurable private document registry.

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  document_storage_provider text not null default 'local_drive',
  document_storage_root text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_document_storage_provider_check check (
    document_storage_provider in ('local_drive', 'google_drive')
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.documents
add column storage_provider text not null default 'local_drive',
add column document_set_key text not null default gen_random_uuid()::text,
add column document_version integer not null default 1,
add column original_filename text,
add column mime_type text,
add column file_size_bytes bigint,
add column checksum_sha256 text,
add column updated_at timestamptz not null default now(),
add constraint documents_storage_provider_check check (
  storage_provider in ('local_drive', 'google_drive')
),
add constraint documents_document_version_check check (document_version > 0),
add constraint documents_file_size_bytes_check check (
  file_size_bytes is null or file_size_bytes >= 0
),
add constraint documents_checksum_sha256_check check (
  checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
),
add constraint documents_document_set_version_unique unique (
  document_set_key,
  document_version
);

create index audit_logs_created_at_idx
on public.audit_logs(created_at desc);

create index audit_logs_entity_idx
on public.audit_logs(entity_type, entity_id, created_at desc);

create index documents_document_set_key_idx
on public.documents(document_set_key, document_version desc);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "app_settings_admin_select"
on public.app_settings
for select
to authenticated
using (public.has_app_role('admin'));

create policy "app_settings_admin_insert"
on public.app_settings
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "app_settings_admin_update"
on public.app_settings
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "audit_logs_admin_select"
on public.audit_logs
for select
to authenticated
using (public.has_app_role('admin'));

create policy "audit_logs_authenticated_insert_own"
on public.audit_logs
for insert
to authenticated
with check (actor_profile_id = public.current_profile_id());

create policy "documents_admin_select"
on public.documents
for select
to authenticated
using (public.has_app_role('admin'));

create policy "documents_admin_insert"
on public.documents
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "documents_admin_update"
on public.documents
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
