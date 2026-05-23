-- Admin eligible voter snapshot policies for meeting publishing.

create policy "eligible_voters_snapshot_admin_select"
on public.eligible_voters_snapshot
for select
to authenticated
using (public.has_app_role('admin'));

create policy "eligible_voters_snapshot_admin_insert"
on public.eligible_voters_snapshot
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "eligible_voters_snapshot_admin_delete"
on public.eligible_voters_snapshot
for delete
to authenticated
using (public.has_app_role('admin'));
