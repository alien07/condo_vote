-- condoVotes schema draft.
-- Mirrors supabase/migrations/0001_initial_schema.sql.
-- RLS is enabled by default. Add scoped policies before exposing user flows.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_result_snapshot_change_after_approval()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.committee_approvals where meeting_id = new.meeting_id
    ) then
      raise exception 'Cannot generate result snapshots after committee approval.';
    end if;

    return new;
  end if;

  if exists (
    select 1 from public.committee_approvals where result_snapshot_id = old.id
  ) then
    raise exception 'Approved result snapshots are immutable.';
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;

create or replace function public.prevent_committee_approval_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Committee approvals are immutable.';
end;
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor text,
  building text,
  area_size numeric(10, 2),
  ownership_percent numeric(10, 6) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_area_size_positive check (area_size is null or area_size > 0),
  constraint rooms_ownership_percent_range check (ownership_percent > 0 and ownership_percent <= 100)
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  line_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_owners (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  owner_id uuid not null references public.owners(id),
  ownership_role text not null default 'owner',
  starts_at date,
  ends_at date,
  status text not null default 'active',
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint room_owners_role_check check (ownership_role in ('owner', 'co_owner')),
  constraint room_owners_status_check check (status in ('active', 'scheduled', 'ended', 'cancelled')),
  constraint room_owners_date_range check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  line_id text,
  default_status text not null default 'resident',
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_default_status_check check (default_status in ('owner', 'resident', 'proxy')),
  constraint profiles_approval_status_check check (approval_status in ('pending', 'approved', 'rejected'))
);

create table public.app_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  role text not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique (profile_id, role),
  constraint app_roles_role_check check (role in ('admin', 'committee'))
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  requested_status text not null,
  room_id uuid references public.rooms(id),
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint approval_requests_requested_status_check check (requested_status in ('owner', 'resident', 'proxy')),
  constraint approval_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create table public.condo_profiles (
  id uuid primary key default gen_random_uuid(),
  juristic_name text not null,
  project_name text not null,
  registration_no text,
  tax_id text,
  address text,
  phone text,
  email text,
  manager_name text,
  logo_storage_path text,
  seal_storage_path text,
  document_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  full_name text not null,
  position_title text not null,
  term_starts_at date,
  term_ends_at date,
  display_order integer not null default 0,
  signature_storage_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text,
  transcript text,
  meeting_number text,
  meeting_type text not null default 'online_vote',
  fiscal_year text,
  location text,
  chairperson_name text,
  quorum_rule text not null default 'one_fourth_total_ownership',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_status_check check (status in ('draft', 'published', 'closed', 'archived')),
  constraint meetings_voting_window_check check (starts_at < ends_at)
);

create table public.proxy_authorizations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  owner_id uuid references public.owners(id),
  proxy_profile_id uuid not null references public.profiles(id),
  status text not null default 'pending',
  valid_from timestamptz,
  valid_until timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint proxy_authorizations_status_check check (status in ('pending', 'approved', 'rejected', 'revoked')),
  constraint proxy_authorizations_valid_window_check check (valid_from is null or valid_until is null or valid_from <= valid_until)
);

create table public.meeting_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  agenda_no text,
  agenda_title text,
  question_text text not null,
  question_type text not null default 'single_choice',
  resolution_type text not null default 'ordinary',
  required_threshold text not null default 'majority_submitted',
  requires_land_office_registration boolean not null default false,
  legal_note text,
  display_order integer not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  constraint meeting_questions_type_check check (question_type in ('single_choice', 'multiple_choice')),
  constraint meeting_questions_display_order_check check (display_order >= 0)
);

create table public.meeting_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.meeting_questions(id),
  choice_text text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint meeting_choices_display_order_check check (display_order >= 0)
);

create table public.eligible_voters_snapshot (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  profile_id uuid not null references public.profiles(id),
  voter_type text not null,
  ownership_percent numeric(10, 6) not null,
  source text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint eligible_voters_snapshot_voter_type_check check (voter_type in ('owner', 'proxy')),
  constraint eligible_voters_snapshot_source_check check (source in ('owner_master', 'proxy_authorization')),
  constraint eligible_voters_snapshot_ownership_percent_range check (ownership_percent > 0 and ownership_percent <= 100)
);

create table public.ballots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  voter_profile_id uuid not null references public.profiles(id),
  status text not null default 'draft',
  submitted_at timestamptz,
  version_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint ballots_status_check check (status in ('draft', 'submitted', 'voided')),
  constraint ballots_version_number_check check (version_number > 0)
);

create table public.ballot_answers (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id),
  question_id uuid not null references public.meeting_questions(id),
  choice_id uuid not null references public.meeting_choices(id),
  created_at timestamptz not null default now(),
  unique (ballot_id, question_id)
);

create table public.ballot_versions (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id),
  version_number integer not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (ballot_id, version_number),
  constraint ballot_versions_version_number_check check (version_number > 0)
);

create table public.manual_ballots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  imported_by uuid not null references public.profiles(id),
  source_label text,
  audit_note text,
  voter_profile_id uuid references public.profiles(id),
  voter_identity_text text,
  identity_status text not null default 'legacy',
  status text not null default 'submitted',
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint manual_ballots_status_check check (status in ('draft', 'submitted', 'voided')),
  constraint manual_ballots_identity_status_check check (identity_status in ('linked', 'pending', 'legacy'))
);

create table public.manual_ballot_answers (
  id uuid primary key default gen_random_uuid(),
  manual_ballot_id uuid not null references public.manual_ballots(id) on delete cascade,
  question_id uuid not null references public.meeting_questions(id),
  choice_id uuid not null references public.meeting_choices(id),
  created_at timestamptz not null default now(),
  unique (manual_ballot_id, question_id)
);

create table public.vote_source_resolutions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  online_ballot_id uuid not null references public.ballots(id),
  manual_ballot_id uuid not null references public.manual_ballots(id),
  chosen_source text not null,
  chosen_ballot_id uuid not null,
  conflict_remark text,
  resolved_by uuid not null references public.profiles(id),
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint vote_source_resolutions_chosen_source_check check (chosen_source in ('online', 'manual')),
  constraint vote_source_resolutions_chosen_ballot_matches_source_check check (
    (chosen_source = 'online' and chosen_ballot_id = online_ballot_id)
    or (chosen_source = 'manual' and chosen_ballot_id = manual_ballot_id)
  )
);

create table public.result_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id),
  payload_json jsonb not null
);

create table public.committee_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  result_snapshot_id uuid not null references public.result_snapshots(id),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  notes text,
  unique (meeting_id),
  unique (meeting_id, result_snapshot_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  storage_provider text not null default 'local_drive',
  storage_path text not null,
  document_set_key text not null default gen_random_uuid()::text,
  document_version integer not null default 1,
  document_type text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  checksum_sha256 text,
  visibility text not null default 'private',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_owner_type_check check (owner_type in ('profile', 'approval_request', 'proxy_authorization', 'meeting', 'result_snapshot')),
  constraint documents_storage_provider_check check (storage_provider in ('local_drive', 'google_drive')),
  constraint documents_document_version_check check (document_version > 0),
  constraint documents_file_size_bytes_check check (file_size_bytes is null or file_size_bytes >= 0),
  constraint documents_checksum_sha256_check check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint documents_document_set_version_unique unique (document_set_key, document_version),
  constraint documents_document_type_check check (document_type in ('owner_verification', 'proxy_authorization', 'meeting_attachment', 'result_pdf', 'other')),
  constraint documents_visibility_check check (visibility in ('private', 'public'))
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  document_storage_provider text not null default 'local_drive',
  document_storage_root text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_document_storage_provider_check check (document_storage_provider in ('local_drive', 'google_drive'))
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

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  template_key text not null,
  status text not null,
  provider_message_id text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint email_logs_status_check check (status in ('queued', 'sending', 'sent', 'failed', 'permanent_failed'))
);

create index room_owners_room_id_idx on public.room_owners(room_id);
create index room_owners_owner_id_idx on public.room_owners(owner_id);
create index profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index profiles_email_idx on public.profiles(email);
create index app_roles_profile_id_idx on public.app_roles(profile_id);
create index approval_requests_profile_id_idx on public.approval_requests(profile_id);
create index approval_requests_room_id_idx on public.approval_requests(room_id);
create index approval_requests_status_idx on public.approval_requests(status);
create index committee_members_active_order_idx on public.committee_members(active, display_order);
create index proxy_authorizations_meeting_id_idx on public.proxy_authorizations(meeting_id);
create index proxy_authorizations_room_id_idx on public.proxy_authorizations(room_id);
create index proxy_authorizations_proxy_profile_id_idx on public.proxy_authorizations(proxy_profile_id);
create index meeting_questions_meeting_id_idx on public.meeting_questions(meeting_id);
create index meeting_choices_question_id_idx on public.meeting_choices(question_id);
create index eligible_voters_snapshot_meeting_id_idx on public.eligible_voters_snapshot(meeting_id);
create index eligible_voters_snapshot_profile_id_idx on public.eligible_voters_snapshot(profile_id);
create index ballots_meeting_id_idx on public.ballots(meeting_id);
create index ballots_voter_profile_id_idx on public.ballots(voter_profile_id);
create index ballot_answers_ballot_id_idx on public.ballot_answers(ballot_id);
create index ballot_versions_ballot_id_idx on public.ballot_versions(ballot_id);
create index manual_ballots_meeting_room_idx on public.manual_ballots(meeting_id, room_id);
create index manual_ballot_answers_manual_ballot_id_idx on public.manual_ballot_answers(manual_ballot_id);
create index manual_ballot_answers_question_idx on public.manual_ballot_answers(question_id);
create index vote_source_resolutions_meeting_room_idx on public.vote_source_resolutions(meeting_id, room_id);
create index vote_source_resolutions_online_ballot_idx on public.vote_source_resolutions(online_ballot_id);
create index vote_source_resolutions_manual_ballot_idx on public.vote_source_resolutions(manual_ballot_id);
create index result_snapshots_meeting_id_idx on public.result_snapshots(meeting_id);
create index committee_approvals_meeting_id_idx on public.committee_approvals(meeting_id);
create index documents_owner_idx on public.documents(owner_type, owner_id);
create index documents_document_set_key_idx on public.documents(document_set_key, document_version desc);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index email_logs_status_created_at_idx on public.email_logs(status, created_at);

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create trigger owners_set_updated_at
before update on public.owners
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger condo_profiles_set_updated_at
before update on public.condo_profiles
for each row execute function public.set_updated_at();

create trigger committee_members_set_updated_at
before update on public.committee_members
for each row execute function public.set_updated_at();

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create trigger ballots_set_updated_at
before update on public.ballots
for each row execute function public.set_updated_at();

create trigger manual_ballots_set_updated_at
before update on public.manual_ballots
for each row execute function public.set_updated_at();

create trigger vote_source_resolutions_set_updated_at
before update on public.vote_source_resolutions
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger result_snapshots_prevent_change_after_approval
before insert or update or delete on public.result_snapshots
for each row execute function public.prevent_result_snapshot_change_after_approval();

create trigger committee_approvals_prevent_change
before update or delete on public.committee_approvals
for each row execute function public.prevent_committee_approval_change();

alter table public.rooms enable row level security;
alter table public.owners enable row level security;
alter table public.room_owners enable row level security;
alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;
alter table public.approval_requests enable row level security;
alter table public.condo_profiles enable row level security;
alter table public.committee_members enable row level security;
alter table public.meetings enable row level security;
alter table public.proxy_authorizations enable row level security;
alter table public.meeting_questions enable row level security;
alter table public.meeting_choices enable row level security;
alter table public.eligible_voters_snapshot enable row level security;
alter table public.ballots enable row level security;
alter table public.ballot_answers enable row level security;
alter table public.ballot_versions enable row level security;
alter table public.manual_ballots enable row level security;
alter table public.manual_ballot_answers enable row level security;
alter table public.vote_source_resolutions enable row level security;
alter table public.result_snapshots enable row level security;
alter table public.committee_approvals enable row level security;
alter table public.documents enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.email_logs enable row level security;
