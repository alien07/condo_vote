-- User-facing approved result summary access and summary history setting.

alter table public.condo_profiles
add column summary_history_limit integer not null default 5,
add constraint condo_profiles_summary_history_limit_check
  check (summary_history_limit between 1 and 20);

create policy "condo_profiles_authenticated_select"
on public.condo_profiles
for select
to authenticated
using (true);

create policy "committee_approvals_authenticated_select"
on public.committee_approvals
for select
to authenticated
using (true);

create policy "result_snapshots_authenticated_approved_select"
on public.result_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.committee_approvals approval
    where approval.result_snapshot_id = result_snapshots.id
  )
);
