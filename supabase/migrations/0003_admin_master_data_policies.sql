-- Admin master-data policies for the first demoable admin screens.

create policy "rooms_admin_select"
on public.rooms
for select
to authenticated
using (public.has_app_role('admin'));

create policy "rooms_admin_insert"
on public.rooms
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "rooms_admin_update"
on public.rooms
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "owners_admin_select"
on public.owners
for select
to authenticated
using (public.has_app_role('admin'));

create policy "owners_admin_insert"
on public.owners
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "owners_admin_update"
on public.owners
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "room_owners_admin_select"
on public.room_owners
for select
to authenticated
using (public.has_app_role('admin'));

create policy "room_owners_admin_insert"
on public.room_owners
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "room_owners_admin_update"
on public.room_owners
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));
