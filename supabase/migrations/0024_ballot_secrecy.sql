-- D015: ballot secrecy per meeting.
-- Admin picks open or secret ballot when creating a meeting. For a secret
-- ballot, admins see totals only, never which room chose what.
--
-- Also fixes result counting: admins had no read access to online ballots,
-- so results only counted manual votes. Result totals now come from
-- meeting_online_tally(), which sums online answers inside the database.

alter table public.meetings
  add column ballot_secrecy text not null default 'open'
    constraint meetings_ballot_secrecy_check check (ballot_secrecy in ('open', 'secret'));

comment on column public.meetings.ballot_secrecy is
  'open: admins can read online answers per room. secret: admins see totals only (D015).';

-- Secrecy is fixed once the meeting leaves draft.
create or replace function public.lock_ballot_secrecy()
returns trigger
language plpgsql
as $$
begin
  if new.ballot_secrecy is distinct from old.ballot_secrecy and old.status <> 'draft' then
    raise exception 'VOTE_SECRECY_LOCKED: Ballot secrecy cannot change after the meeting is published.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger meetings_lock_ballot_secrecy
before update of ballot_secrecy on public.meetings
for each row execute function public.lock_ballot_secrecy();

-- Admins can see which rooms voted online (no answers here).
create policy "ballots_admin_select"
on public.ballots
for select
to authenticated
using (public.has_app_role('admin'));

-- Admins can read online answers only for open-ballot meetings, for example to
-- compare a conflict between an online and a manual ballot.
create policy "ballot_answers_admin_select_open_ballot"
on public.ballot_answers
for select
to authenticated
using (
  public.has_app_role('admin')
  and exists (
    select 1
    from public.ballots ballot
    join public.meetings meeting on meeting.id = ballot.meeting_id
    where ballot.id = ballot_answers.ballot_id
      and meeting.ballot_secrecy = 'open'
  )
);

-- Totals per choice for online ballots that count in the result.
-- A room with both an online and a manual ballot counts online only when a
-- matching conflict resolution chose the online ballot.
create or replace function public.meeting_online_tally(p_meeting_id uuid)
returns table (choice_id uuid, vote_count integer, ownership numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_app_role('admin') then
    raise exception 'RESULT_FORBIDDEN: Only admins can generate results.'
      using errcode = 'P0001';
  end if;

  return query
  with effective_online as (
    select ballot.id, ballot.room_id
    from public.ballots ballot
    where ballot.meeting_id = p_meeting_id
      and ballot.status = 'submitted'
      and (
        not exists (
          select 1
          from public.manual_ballots manual
          where manual.meeting_id = p_meeting_id
            and manual.room_id = ballot.room_id
            and manual.status = 'submitted'
            and manual.identity_status <> 'pending'
        )
        or exists (
          select 1
          from public.vote_source_resolutions resolution
          join public.manual_ballots manual on manual.id = resolution.manual_ballot_id
          where resolution.meeting_id = p_meeting_id
            and resolution.room_id = ballot.room_id
            and resolution.online_ballot_id = ballot.id
            and resolution.chosen_source = 'online'
            and manual.status = 'submitted'
        )
      )
  )
  select
    answer.choice_id,
    count(*)::integer as vote_count,
    coalesce(sum(eligible.ownership_percent), 0)::numeric as ownership
  from effective_online online
  join public.ballot_answers answer on answer.ballot_id = online.id
  left join public.eligible_voters_snapshot eligible
    on eligible.meeting_id = p_meeting_id
   and eligible.room_id = online.room_id
  group by answer.choice_id;
end;
$$;

revoke all on function public.meeting_online_tally(uuid) from public;
grant execute on function public.meeting_online_tally(uuid) to authenticated;
