-- Admin proxy authorization policies for proxy review workflow.

create policy "proxy_authorizations_admin_select"
on public.proxy_authorizations
for select
to authenticated
using (public.has_app_role('admin'));

create policy "proxy_authorizations_admin_insert"
on public.proxy_authorizations
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "proxy_authorizations_admin_update"
on public.proxy_authorizations
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
