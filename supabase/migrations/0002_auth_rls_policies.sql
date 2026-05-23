-- Baseline RLS for Supabase Auth integration.
-- Keep these policies narrow until admin and voting workflows are implemented.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.has_app_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_roles
    where profile_id = public.current_profile_id()
      and role = required_role
  )
$$;

revoke execute on function public.current_profile_id() from public;
revoke execute on function public.has_app_role(text) from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_app_role(text) to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.has_app_role('admin')
);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "app_roles_select_own_or_admin"
on public.app_roles
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.has_app_role('admin')
);

create policy "app_roles_admin_insert"
on public.app_roles
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "app_roles_admin_update"
on public.app_roles
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "app_roles_admin_delete"
on public.app_roles
for delete
to authenticated
using (public.has_app_role('admin'));
