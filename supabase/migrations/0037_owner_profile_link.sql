-- D024: an owner of record is linked to one account by id, not matched by
-- email each time rights are checked.

alter table public.owners
  add column profile_id uuid references public.profiles(id) on delete set null;

create unique index owners_profile_id_key
  on public.owners (profile_id)
  where profile_id is not null;

comment on column public.owners.profile_id is
  'Account of this owner of record (D024). Set only by link functions.';

-- Only the link functions (security definer) may set profile_id. Office
-- staff keep insert/update on the other columns.
revoke insert, update on public.owners from anon, authenticated;
grant insert (id, full_name, email, phone, line_id, active) on public.owners to authenticated;
grant update (full_name, email, phone, line_id, active) on public.owners to authenticated;

-- One email per active owner (D024: no shared emails). Stop with a clear
-- message if existing data breaks the rule, so the office can fix it first.
do $$
declare
  v_dupes text;
begin
  select string_agg(email || ' (' || n || ')', ', ')
  into v_dupes
  from (
    select lower(btrim(email)) as email, count(*) as n
    from public.owners
    where active and email is not null and btrim(email) <> ''
    group by 1
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception 'D024: active owners share an email, fix them before this migration: %', v_dupes;
  end if;
end;
$$;

create unique index owners_active_email_key
  on public.owners (lower(btrim(email)))
  where active and email is not null and btrim(email) <> '';

-- Masks an email for audit details: first letter and domain only.
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or btrim(p_email) = '' then null
    when position('@' in p_email) < 2 then '***'
    else left(btrim(p_email), 1) || '***' || substring(btrim(p_email) from position('@' in btrim(p_email)))
  end;
$$;

-- Owner email is the key for the first link, so only an admin (manager)
-- changes it, and every change is audited (D024). Office staff still set
-- the email when they add an owner.
create or replace function public.owners_guard_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if lower(btrim(coalesce(old.email, ''))) = lower(btrim(coalesce(new.email, ''))) then
    return new;
  end if;

  -- Service-role scripts (seed, tests) have no signed-in actor.
  if v_actor is null then
    return new;
  end if;

  if not public.has_app_role('admin') then
    raise exception 'OWNER_EMAIL_ADMIN_ONLY: Only an admin can change an owner''s email.'
      using errcode = 'P0001';
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('owner.email_changed', v_actor, 'owner', new.id,
    jsonb_build_object(
      'from', public.mask_email(old.email),
      'to', public.mask_email(new.email),
      'linked_profile_id', new.profile_id));

  return new;
end;
$$;

create trigger owners_guard_email_change
before update of email on public.owners
for each row execute function public.owners_guard_email_change();

-- True when the account has accepted the current privacy notice, or no
-- consent is required (D016).
create or replace function public.profile_has_consent(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select not settings.consent_required
      or exists (
        select 1
        from public.profile_consents consent
        where consent.profile_id = p_profile_id
          and consent.notice_version = settings.notice_version
      )
    from public.privacy_settings settings
  ), true);
$$;

revoke all on function public.profile_has_consent(uuid) from public;

-- Links one owner to one account when the email matches exactly one active
-- unlinked owner and exactly one account, and the account has consented.
-- Approves the account as an owner unless it was rejected. Returns true
-- when a link was made.
create or replace function public.try_link_owner_profile(
  p_owner_id uuid,
  p_profile_id uuid,
  p_actor_profile_id uuid,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.owners%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
begin
  select * into v_owner from public.owners where id = p_owner_id for update;
  select * into v_profile from public.profiles where id = p_profile_id for update;

  if v_owner.id is null or v_profile.id is null
    or not v_owner.active
    or v_owner.profile_id is not null
    or v_profile.approval_status = 'rejected'
    or v_owner.email is null then
    return false;
  end if;

  v_email := lower(btrim(v_owner.email));

  if v_email = '' or lower(btrim(v_profile.email)) <> v_email then
    return false;
  end if;

  -- Already linked to another owner, or the email is ambiguous: an admin
  -- decides (D024, no shared emails).
  if exists (select 1 from public.owners o where o.profile_id = p_profile_id)
    or (select count(*) from public.owners o
        where o.active and o.profile_id is null and lower(btrim(o.email)) = v_email) <> 1
    or (select count(*) from public.profiles p where lower(btrim(p.email)) = v_email) <> 1 then
    return false;
  end if;

  if not public.profile_has_consent(p_profile_id) then
    return false;
  end if;

  update public.owners set profile_id = p_profile_id where id = p_owner_id;

  update public.profiles
  set approval_status = 'approved',
      default_status = 'owner'
  where id = p_profile_id
    and (approval_status <> 'approved' or default_status <> 'owner');

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('owner.profile_linked', coalesce(p_actor_profile_id, p_profile_id), 'owner', p_owner_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'source', p_source,
      'previous_approval_status', v_profile.approval_status,
      'previous_default_status', v_profile.default_status));

  return true;
end;
$$;

revoke all on function public.try_link_owner_profile(uuid, uuid, uuid, text) from public;

-- Called by the signed-in user (after the consent page). Returns the linked
-- owner id, or null when nothing was linked.
create or replace function public.link_my_owner_record()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_owner_id uuid;
begin
  if v_profile_id is null then
    return null;
  end if;

  select o.id into v_owner_id
  from public.owners o
  join public.profiles p on p.id = v_profile_id
  where o.active
    and o.profile_id is null
    and lower(btrim(o.email)) = lower(btrim(p.email))
  limit 1;

  if v_owner_id is not null
    and public.try_link_owner_profile(v_owner_id, v_profile_id, v_profile_id, 'sign_in') then
    return v_owner_id;
  end if;

  return null;
end;
$$;

revoke all on function public.link_my_owner_record() from public;
grant execute on function public.link_my_owner_record() to authenticated;

-- New or changed owner email (form, Excel import): link if the account
-- already exists.
create or replace function public.owners_link_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if new.profile_id is null and new.active and new.email is not null then
    select p.id into v_profile_id
    from public.profiles p
    where lower(btrim(p.email)) = lower(btrim(new.email))
    limit 1;

    if v_profile_id is not null then
      perform public.try_link_owner_profile(
        new.id, v_profile_id, public.current_profile_id(), 'owner_email');
    end if;
  end if;

  return null;
end;
$$;

create trigger owners_link_by_email
after insert or update of email, active on public.owners
for each row execute function public.owners_link_by_email();

-- New account (first sign-in): link when no consent is needed yet. With
-- consent required, the consent page links instead.
create or replace function public.profiles_link_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select o.id into v_owner_id
  from public.owners o
  where o.active
    and o.profile_id is null
    and lower(btrim(o.email)) = lower(btrim(new.email))
  limit 1;

  if v_owner_id is not null then
    perform public.try_link_owner_profile(v_owner_id, new.id, new.id, 'sign_in');
  end if;

  return null;
end;
$$;

create trigger profiles_link_owner
after insert or update of email on public.profiles
for each row execute function public.profiles_link_owner();

-- Accepting the notice also links the owner record (D024).
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

  perform public.link_my_owner_record();
end;
$$;

-- Rights follow the link, not the email.
create or replace function public.room_owner_profile_id(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.room_owners ro
  join public.owners o on o.id = ro.owner_id
  join public.profiles p on p.id = o.profile_id
  where ro.room_id = p_room_id
    and ro.ends_at is null
    and ro.status = 'active'
    and ro.ownership_role = 'owner'
    and p.approval_status = 'approved'
    and p.default_status = 'owner'
  order by ro.created_at, p.created_at
  limit 1;
$$;

create or replace function public.my_member_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_approved boolean;
  v_owns_room boolean;
  v_has_ballot_right boolean;
  v_delegated jsonb;
begin
  select * into v_profile from public.profiles where id = public.current_profile_id();

  if not found then
    return jsonb_build_object(
      'approved', false, 'can_view_results', false, 'can_vote', false,
      'owns_room', false, 'delegated_rooms', '[]'::jsonb);
  end if;

  v_approved := public.profile_access_active(v_profile.id);

  select exists (
    select 1
    from public.room_owners ro
    join public.owners o on o.id = ro.owner_id
    where ro.status = 'active'
      and o.profile_id = v_profile.id
  ) into v_owns_room;

  select exists (
    select 1 from public.eligible_voters_snapshot e where e.profile_id = v_profile.id
  ) into v_has_ballot_right;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pa.id,
      'kind', pa.kind,
      'room_number', r.room_number,
      'meeting_title', m.title,
      'proxy_name', proxy.full_name,
      'ends_at', m.ends_at,
      'can_cancel', pa.kind = 'co_owner'
        and pa.granted_by_owner_profile_id = v_profile.id
        and not exists (select 1 from public.ballots b where b.meeting_id = pa.meeting_id and b.room_id = pa.room_id)
    ) order by m.ends_at, r.room_number), '[]'::jsonb)
  into v_delegated
  from public.proxy_authorizations pa
  join public.rooms r on r.id = pa.room_id
  join public.meetings m on m.id = pa.meeting_id
  join public.profiles proxy on proxy.id = pa.proxy_profile_id
  where pa.status = 'approved'
    and m.status = 'published'
    and m.closed_at is null
    and m.ends_at > now()
    and exists (
      select 1
      from public.room_owners ro
      join public.owners o on o.id = ro.owner_id
      where ro.room_id = pa.room_id
        and ro.status = 'active'
        and o.profile_id = v_profile.id
    );

  return jsonb_build_object(
    'approved', v_approved,
    'can_view_results', public.is_approved_member(),
    'can_vote', v_approved and (
      v_profile.default_status in ('owner', 'proxy') or v_owns_room or v_has_ballot_right
    ),
    'owns_room', v_owns_room,
    'delegated_rooms', case when v_approved then v_delegated else '[]'::jsonb end
  );
end;
$$;

-- One-time link of existing data, same exact-one-match rule. Existing
-- accounts keep their approval and member status; consent is not checked
-- because these owners already had the email match before D024.
with owner_emails as (
  select lower(btrim(email)) as email
  from public.owners
  where active and email is not null and btrim(email) <> ''
  group by lower(btrim(email))
  having count(*) = 1
),
profile_emails as (
  select lower(btrim(email)) as email
  from public.profiles
  group by lower(btrim(email))
  having count(*) = 1
),
matches as (
  select o.id as owner_id, p.id as profile_id
  from public.owners o
  join owner_emails oe on oe.email = lower(btrim(o.email))
  join profile_emails pe on pe.email = oe.email
  join public.profiles p on lower(btrim(p.email)) = pe.email
  where o.active and o.profile_id is null
),
linked as (
  update public.owners o
  set profile_id = m.profile_id
  from matches m
  where o.id = m.owner_id
  returning o.id as owner_id, o.profile_id
)
insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
select 'owner.profile_linked', l.profile_id, 'owner', l.owner_id,
  jsonb_build_object('profile_id', l.profile_id, 'source', 'migration_0037')
from linked l;
