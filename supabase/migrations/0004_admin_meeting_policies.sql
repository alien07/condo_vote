-- Admin meeting policies for the first meeting setup screen.

create policy "meetings_admin_select"
on public.meetings
for select
to authenticated
using (public.has_app_role('admin'));

create policy "meetings_admin_insert"
on public.meetings
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "meetings_admin_update"
on public.meetings
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
