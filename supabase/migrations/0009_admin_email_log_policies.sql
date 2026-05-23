-- Admin policies for email queue/log visibility and status management.

create policy "email_logs_admin_select"
on public.email_logs
for select
to authenticated
using (public.has_app_role('admin'));

create policy "email_logs_admin_insert"
on public.email_logs
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "email_logs_admin_update"
on public.email_logs
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
