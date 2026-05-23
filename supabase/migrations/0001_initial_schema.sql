-- Initial condoVotes schema draft.
-- Review RLS, indexes, check constraints, and trigger strategy before production.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor text,
  building text,
  area_size numeric(10, 2),
  ownership_percent numeric(10, 6) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  line_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table room_owners (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  owner_id uuid not null references owners(id),
  ownership_role text not null default 'owner',
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null,
  phone text,
  line_id text,
  default_status text not null default 'resident',
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  role text not null,
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  unique (profile_id, role)
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  requested_status text not null,
  room_id uuid references rooms(id),
  status text not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table meetings (
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
  updated_at timestamptz not null default now()
);

create table proxy_authorizations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  room_id uuid not null references rooms(id),
  owner_id uuid references owners(id),
  proxy_profile_id uuid not null references profiles(id),
  status text not null default 'pending',
  valid_from timestamptz,
  valid_until timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table meeting_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  question_text text not null,
  question_type text not null default 'single_choice',
  display_order integer not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table meeting_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references meeting_questions(id),
  choice_text text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table eligible_voters_snapshot (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  room_id uuid not null references rooms(id),
  profile_id uuid not null references profiles(id),
  voter_type text not null,
  ownership_percent numeric(10, 6) not null,
  source text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, room_id)
);

create table ballots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  room_id uuid not null references rooms(id),
  voter_profile_id uuid not null references profiles(id),
  status text not null default 'draft',
  submitted_at timestamptz,
  version_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id)
);

create table ballot_answers (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references ballots(id),
  question_id uuid not null references meeting_questions(id),
  choice_id uuid not null references meeting_choices(id),
  created_at timestamptz not null default now(),
  unique (ballot_id, question_id)
);

create table ballot_versions (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references ballots(id),
  version_number integer not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (ballot_id, version_number)
);

create table result_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  generated_at timestamptz not null default now(),
  generated_by uuid references profiles(id),
  payload_json jsonb not null
);

create table committee_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id),
  result_snapshot_id uuid not null references result_snapshots(id),
  approved_by uuid not null references profiles(id),
  approved_at timestamptz not null default now(),
  notes text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  storage_path text not null,
  document_type text not null,
  visibility text not null default 'private',
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  template_key text not null,
  status text not null,
  provider_message_id text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
