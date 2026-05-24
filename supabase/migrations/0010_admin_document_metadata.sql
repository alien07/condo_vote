-- Administrative metadata required for juristic-person result documents.

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
  updated_at timestamptz not null default now(),
  constraint committee_members_display_order_check check (display_order >= 0),
  constraint committee_members_term_range check (
    term_starts_at is null
    or term_ends_at is null
    or term_starts_at <= term_ends_at
  )
);

alter table public.meetings
add column meeting_number text,
add column meeting_type text not null default 'online_vote',
add column fiscal_year text,
add column location text,
add column chairperson_name text,
add column quorum_rule text not null default 'one_fourth_total_ownership';

alter table public.meeting_questions
add column agenda_no text,
add column agenda_title text,
add column resolution_type text not null default 'ordinary',
add column required_threshold text not null default 'majority_submitted',
add column requires_land_office_registration boolean not null default false,
add column legal_note text,
add constraint meeting_questions_resolution_type_check check (
  resolution_type in ('ordinary', 'special', 'informational')
),
add constraint meeting_questions_required_threshold_check check (
  required_threshold in (
    'majority_submitted',
    'one_third_total',
    'half_total',
    'three_fourths_total',
    'informational'
  )
);

create index committee_members_active_order_idx
on public.committee_members(active, display_order);

create trigger condo_profiles_set_updated_at
before update on public.condo_profiles
for each row
execute function public.set_updated_at();

create trigger committee_members_set_updated_at
before update on public.committee_members
for each row
execute function public.set_updated_at();

alter table public.condo_profiles enable row level security;
alter table public.committee_members enable row level security;

create policy "condo_profiles_admin_select"
on public.condo_profiles
for select
to authenticated
using (public.has_app_role('admin'));

create policy "condo_profiles_admin_insert"
on public.condo_profiles
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "condo_profiles_admin_update"
on public.condo_profiles
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "committee_members_admin_select"
on public.committee_members
for select
to authenticated
using (public.has_app_role('admin'));

create policy "committee_members_admin_insert"
on public.committee_members
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "committee_members_admin_update"
on public.committee_members
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
