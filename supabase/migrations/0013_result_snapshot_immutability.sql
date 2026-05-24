-- Lock result snapshots after committee approval.

create unique index committee_approvals_one_result_per_meeting_idx
on public.committee_approvals(meeting_id);

create or replace function public.prevent_result_snapshot_change_after_approval()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.committee_approvals
      where meeting_id = new.meeting_id
    ) then
      raise exception 'Cannot generate result snapshots after committee approval.';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from public.committee_approvals
    where result_snapshot_id = old.id
  ) then
    raise exception 'Approved result snapshots are immutable.';
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;

create trigger result_snapshots_prevent_change_after_approval
before insert or update or delete on public.result_snapshots
for each row
execute function public.prevent_result_snapshot_change_after_approval();

create or replace function public.prevent_committee_approval_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Committee approvals are immutable.';
end;
$$;

create trigger committee_approvals_prevent_change
before update or delete on public.committee_approvals
for each row
execute function public.prevent_committee_approval_change();
