-- Admin policies for generated result snapshots and committee approvals.

create policy "result_snapshots_admin_select"
on public.result_snapshots
for select
to authenticated
using (public.has_app_role('admin'));

create policy "result_snapshots_admin_insert"
on public.result_snapshots
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "committee_approvals_admin_select"
on public.committee_approvals
for select
to authenticated
using (public.has_app_role('admin'));

create policy "committee_approvals_admin_insert"
on public.committee_approvals
for insert
to authenticated
with check (public.has_app_role('admin'));
