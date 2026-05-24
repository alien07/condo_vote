-- Replace flat manual vote entries with manual ballot tables.

drop table if exists public.vote_source_resolutions cascade;
drop table if exists public.manual_vote_entries cascade;

create table public.manual_ballots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  imported_by uuid not null references public.profiles(id),
  source_label text,
  audit_note text,
  status text not null default 'submitted',
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint manual_ballots_status_check check (status in ('draft', 'submitted', 'voided'))
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
  constraint vote_source_resolutions_chosen_source_check check (
    chosen_source in ('online', 'manual')
  ),
  constraint vote_source_resolutions_chosen_ballot_matches_source_check check (
    (chosen_source = 'online' and chosen_ballot_id = online_ballot_id)
    or (chosen_source = 'manual' and chosen_ballot_id = manual_ballot_id)
  )
);

create index manual_ballots_meeting_room_idx
on public.manual_ballots(meeting_id, room_id);

create index manual_ballot_answers_manual_ballot_id_idx
on public.manual_ballot_answers(manual_ballot_id);

create index manual_ballot_answers_question_idx
on public.manual_ballot_answers(question_id);

create index vote_source_resolutions_meeting_room_idx
on public.vote_source_resolutions(meeting_id, room_id);

create index vote_source_resolutions_online_ballot_idx
on public.vote_source_resolutions(online_ballot_id);

create index vote_source_resolutions_manual_ballot_idx
on public.vote_source_resolutions(manual_ballot_id);

create trigger manual_ballots_set_updated_at
before update on public.manual_ballots
for each row
execute function public.set_updated_at();

create trigger vote_source_resolutions_set_updated_at
before update on public.vote_source_resolutions
for each row
execute function public.set_updated_at();

alter table public.manual_ballots enable row level security;
alter table public.manual_ballot_answers enable row level security;
alter table public.vote_source_resolutions enable row level security;

create policy "manual_ballots_admin_select"
on public.manual_ballots
for select
to authenticated
using (public.has_app_role('admin'));

create policy "manual_ballots_admin_insert"
on public.manual_ballots
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "manual_ballots_admin_update"
on public.manual_ballots
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "manual_ballot_answers_admin_select"
on public.manual_ballot_answers
for select
to authenticated
using (public.has_app_role('admin'));

create policy "manual_ballot_answers_admin_insert"
on public.manual_ballot_answers
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "manual_ballot_answers_admin_update"
on public.manual_ballot_answers
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "vote_source_resolutions_admin_select"
on public.vote_source_resolutions
for select
to authenticated
using (public.has_app_role('admin'));

create policy "vote_source_resolutions_admin_insert"
on public.vote_source_resolutions
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "vote_source_resolutions_admin_update"
on public.vote_source_resolutions
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
