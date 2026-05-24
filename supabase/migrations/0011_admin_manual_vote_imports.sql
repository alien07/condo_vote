-- Manual vote imports and source conflict resolution for mixed offline/online voting.

create table public.manual_vote_entries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  question_id uuid not null references public.meeting_questions(id),
  choice_id uuid not null references public.meeting_choices(id),
  source_label text,
  audit_note text,
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id, question_id)
);

create table public.vote_source_resolutions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  room_id uuid not null references public.rooms(id),
  chosen_source text not null,
  conflict_remark text,
  resolved_by uuid not null references public.profiles(id),
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, room_id),
  constraint vote_source_resolutions_chosen_source_check check (
    chosen_source in ('online', 'manual')
  )
);

create index manual_vote_entries_meeting_room_idx
on public.manual_vote_entries(meeting_id, room_id);

create index manual_vote_entries_question_idx
on public.manual_vote_entries(question_id);

create index vote_source_resolutions_meeting_room_idx
on public.vote_source_resolutions(meeting_id, room_id);

create trigger manual_vote_entries_set_updated_at
before update on public.manual_vote_entries
for each row
execute function public.set_updated_at();

create trigger vote_source_resolutions_set_updated_at
before update on public.vote_source_resolutions
for each row
execute function public.set_updated_at();

alter table public.manual_vote_entries enable row level security;
alter table public.vote_source_resolutions enable row level security;

create policy "manual_vote_entries_admin_select"
on public.manual_vote_entries
for select
to authenticated
using (public.has_app_role('admin'));

create policy "manual_vote_entries_admin_insert"
on public.manual_vote_entries
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "manual_vote_entries_admin_update"
on public.manual_vote_entries
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
