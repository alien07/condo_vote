-- D016: system_admin role and PDPA consent.
-- system_admin owns technical, service, and maintenance settings (document
-- storage, privacy notice, retention). Meeting admins are not expected to be
-- technical. Every user accepts the privacy notice before using the app.

-- Roles ------------------------------------------------------------------------
alter table public.app_roles drop constraint app_roles_role_check;
alter table public.app_roles
  add constraint app_roles_role_check check (role in ('admin', 'committee', 'system_admin'));

-- Only a system admin can grant or remove the system_admin role.
drop policy "app_roles_select_own_or_admin" on public.app_roles;
drop policy "app_roles_admin_insert" on public.app_roles;
drop policy "app_roles_admin_update" on public.app_roles;
drop policy "app_roles_admin_delete" on public.app_roles;

create policy "app_roles_select_own_or_admin"
on public.app_roles
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.has_app_role('admin')
  or public.has_app_role('system_admin')
);

create policy "app_roles_admin_insert"
on public.app_roles
for insert
to authenticated
with check (
  (public.has_app_role('admin') and role <> 'system_admin')
  or public.has_app_role('system_admin')
);

create policy "app_roles_admin_update"
on public.app_roles
for update
to authenticated
using (
  (public.has_app_role('admin') and role <> 'system_admin')
  or public.has_app_role('system_admin')
)
with check (
  (public.has_app_role('admin') and role <> 'system_admin')
  or public.has_app_role('system_admin')
);

create policy "app_roles_admin_delete"
on public.app_roles
for delete
to authenticated
using (
  (public.has_app_role('admin') and role <> 'system_admin')
  or public.has_app_role('system_admin')
);

-- Technical settings move to system_admin. Admins can still read them.
drop policy "app_settings_admin_select" on public.app_settings;
drop policy "app_settings_admin_insert" on public.app_settings;
drop policy "app_settings_admin_update" on public.app_settings;

create policy "app_settings_admin_select"
on public.app_settings
for select
to authenticated
using (public.has_app_role('admin') or public.has_app_role('system_admin'));

create policy "app_settings_system_admin_insert"
on public.app_settings
for insert
to authenticated
with check (public.has_app_role('system_admin'));

create policy "app_settings_system_admin_update"
on public.app_settings
for update
to authenticated
using (public.has_app_role('system_admin'))
with check (public.has_app_role('system_admin'));

-- Privacy settings (one row) ------------------------------------------------------
create table public.privacy_settings (
  id boolean primary key default true constraint privacy_settings_single_row check (id),
  consent_required boolean not null default true,
  notice_version integer not null default 1 check (notice_version > 0),
  notice_text text not null,
  retention_months_vote_records integer not null default 120
    check (retention_months_vote_records between 12 and 600),
  retention_months_inactive_profiles integer not null default 24
    check (retention_months_inactive_profiles between 1 and 600),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.privacy_settings is
  'PDPA privacy notice and retention periods, managed by system_admin (D016).';

insert into public.privacy_settings (notice_text) values (
$notice$We collect your name, email, phone number, room, and voting records to run condominium meetings and votes, verify voting rights, and keep the legal record of results.

Your data is shared only with the juristic person, the committee, and the service providers that run this system. Ballot records are kept for the period set by the system administrator, then deleted or anonymized.

You can ask to see, correct, or delete your personal data by contacting the juristic person office. Some voting records must be kept to meet legal requirements.$notice$
);

-- Changing the notice text starts a new version, so everyone accepts it again.
create or replace function public.bump_privacy_notice_version()
returns trigger
language plpgsql
as $$
begin
  if new.notice_text is distinct from old.notice_text then
    new.notice_version := old.notice_version + 1;
  else
    new.notice_version := old.notice_version;
  end if;
  new.updated_at := now();
  new.updated_by := public.current_profile_id();
  return new;
end;
$$;

create trigger privacy_settings_bump_version
before update on public.privacy_settings
for each row execute function public.bump_privacy_notice_version();

alter table public.privacy_settings enable row level security;

create policy "privacy_settings_authenticated_select"
on public.privacy_settings
for select
to authenticated
using (true);

create policy "privacy_settings_system_admin_update"
on public.privacy_settings
for update
to authenticated
using (public.has_app_role('system_admin'))
with check (public.has_app_role('system_admin'));

-- Consent records -------------------------------------------------------------------
create table public.profile_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notice_version integer not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, notice_version)
);

alter table public.profile_consents enable row level security;

create policy "profile_consents_select_own_or_admin"
on public.profile_consents
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.has_app_role('admin')
  or public.has_app_role('system_admin')
);

-- True when the signed-in user still has to accept the current notice.
create or replace function public.needs_privacy_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select settings.consent_required
      and not exists (
        select 1
        from public.profile_consents consent
        where consent.profile_id = public.current_profile_id()
          and consent.notice_version = settings.notice_version
      )
    from public.privacy_settings settings
  ), false);
$$;

-- Records consent to the notice version the user saw.
create or replace function public.accept_privacy_notice(p_notice_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_current integer;
begin
  if v_profile_id is null then
    raise exception 'PRIVACY_NOT_SIGNED_IN: Sign in first.' using errcode = 'P0001';
  end if;

  select notice_version into v_current from public.privacy_settings;

  if v_current is distinct from p_notice_version then
    raise exception 'PRIVACY_NOTICE_CHANGED: The privacy notice changed. Read the new version.'
      using errcode = 'P0001';
  end if;

  insert into public.profile_consents (profile_id, notice_version)
  values (v_profile_id, p_notice_version)
  on conflict (profile_id, notice_version) do nothing;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('privacy.accepted', v_profile_id, 'profile', v_profile_id,
    jsonb_build_object('notice_version', p_notice_version));
end;
$$;

revoke all on function public.needs_privacy_consent() from public;
revoke all on function public.accept_privacy_notice(integer) from public;
grant execute on function public.needs_privacy_consent() to authenticated;
grant execute on function public.accept_privacy_notice(integer) to authenticated;
