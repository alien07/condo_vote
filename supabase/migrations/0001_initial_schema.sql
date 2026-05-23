-- Initial condoVotes schema.
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
  created_at timestamptz not null default now(),
  constraint room_owners_role_check check (ownership_role in ('owner', 'co_owner')),
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

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text,
  transcript text,
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
  question_text text not null,
  question_type text not null default 'single_choice',
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
  unique (meeting_id, result_snapshot_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  storage_path text not null,
  document_type text not null,
  visibility text not null default 'private',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint documents_owner_type_check check (owner_type in ('profile', 'approval_request', 'proxy_authorization', 'meeting', 'result_snapshot')),
  constraint documents_document_type_check check (document_type in ('owner_verification', 'proxy_authorization', 'meeting_attachment', 'result_pdf', 'other')),
  constraint documents_visibility_check check (visibility in ('private', 'public'))
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
create index result_snapshots_meeting_id_idx on public.result_snapshots(meeting_id);
create index committee_approvals_meeting_id_idx on public.committee_approvals(meeting_id);
create index documents_owner_idx on public.documents(owner_type, owner_id);
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

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create trigger ballots_set_updated_at
before update on public.ballots
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.owners enable row level security;
alter table public.room_owners enable row level security;
alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;
alter table public.approval_requests enable row level security;
alter table public.meetings enable row level security;
alter table public.proxy_authorizations enable row level security;
alter table public.meeting_questions enable row level security;
alter table public.meeting_choices enable row level security;
alter table public.eligible_voters_snapshot enable row level security;
alter table public.ballots enable row level security;
alter table public.ballot_answers enable row level security;
alter table public.ballot_versions enable row level security;
alter table public.result_snapshots enable row level security;
alter table public.committee_approvals enable row level security;
alter table public.documents enable row level security;
alter table public.email_logs enable row level security;
