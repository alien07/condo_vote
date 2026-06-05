alter table public.manual_ballots
add column voter_profile_id uuid references public.profiles(id),
add column voter_identity_text text,
add column identity_status text not null default 'legacy',
add constraint manual_ballots_identity_status_check
  check (identity_status in ('linked', 'pending', 'legacy'));

update public.manual_ballots
set
  identity_status = case
    when status = 'draft' then 'pending'
    else 'legacy'
  end,
  voter_identity_text = coalesce(voter_identity_text, nullif(audit_note, ''))
where identity_status = 'legacy'
  and voter_profile_id is null
  and voter_identity_text is null;

create index manual_ballots_identity_status_idx
on public.manual_ballots(identity_status);

create index manual_ballots_voter_profile_id_idx
on public.manual_ballots(voter_profile_id);

create index manual_ballots_meeting_status_identity_idx
on public.manual_ballots(meeting_id, status, identity_status);
