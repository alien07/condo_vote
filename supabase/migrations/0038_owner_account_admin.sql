-- D024 follow-up: an admin links, unlinks or moves the account of an owner of
-- record, with a reason, and open meetings follow the change.

-- p_profile_email null or empty unlinks. Otherwise links (or moves) the owner
-- to the account with that email. Rooms of the owner that have not voted in
-- an open meeting get the new account in the eligible-voter snapshot (or lose
-- the row on unlink). Rooms that already voted keep their vote.
create or replace function public.admin_set_owner_account(
  p_owner_id uuid,
  p_profile_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_owner public.owners%rowtype;
  v_old uuid;
  v_new uuid;
  v_new_status text;
  v_email text := lower(btrim(coalesce(p_profile_email, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_updated integer := 0;
  v_kept integer := 0;
  v_action text;
begin
  if v_actor is null or not public.has_app_role('admin') then
    raise exception 'OWNER_ACCOUNT_ADMIN_ONLY: Only an admin can change an owner''s account.'
      using errcode = 'P0001';
  end if;

  if char_length(v_reason) < 5 then
    raise exception 'OWNER_ACCOUNT_REASON_REQUIRED: Give a reason of at least 5 characters.'
      using errcode = 'P0001';
  end if;

  select * into v_owner from public.owners where id = p_owner_id for update;

  if v_owner.id is null then
    raise exception 'OWNER_ACCOUNT_OWNER_NOT_FOUND: Owner not found.' using errcode = 'P0001';
  end if;

  v_old := v_owner.profile_id;

  if v_email <> '' then
    select p.id, p.approval_status into v_new, v_new_status
    from public.profiles p
    where lower(btrim(p.email)) = v_email;

    if v_new is null then
      raise exception 'OWNER_ACCOUNT_PROFILE_NOT_FOUND: No account has this email. Ask the owner to sign in once first.'
        using errcode = 'P0001';
    end if;

    if v_new_status = 'rejected' then
      raise exception 'OWNER_ACCOUNT_PROFILE_REJECTED: This account was rejected. Change its approval first.'
        using errcode = 'P0001';
    end if;

    if v_new is not distinct from v_old then
      raise exception 'OWNER_ACCOUNT_SAME: The owner is already linked to this account.'
        using errcode = 'P0001';
    end if;

    if exists (select 1 from public.owners o where o.profile_id = v_new and o.id <> p_owner_id) then
      raise exception 'OWNER_ACCOUNT_PROFILE_TAKEN: This account is already linked to another owner.'
        using errcode = 'P0001';
    end if;
  elsif v_old is null then
    raise exception 'OWNER_ACCOUNT_NOT_LINKED: The owner has no account to unlink.'
      using errcode = 'P0001';
  end if;

  update public.owners set profile_id = v_new where id = p_owner_id;

  -- The new account votes as an owner; the old one is a resident again.
  if v_new is not null then
    update public.profiles
    set approval_status = 'approved', default_status = 'owner'
    where id = v_new and (approval_status <> 'approved' or default_status <> 'owner');
  end if;

  if v_old is not null then
    update public.profiles
    set default_status = 'resident'
    where id = v_old and default_status = 'owner';
  end if;

  -- Open meetings: rooms of this owner whose snapshot row is the owner's.
  with owner_rooms as (
    select ro.room_id
    from public.room_owners ro
    where ro.owner_id = p_owner_id
      and ro.status = 'active'
      and ro.ends_at is null
      and ro.ownership_role = 'owner'
  ),
  open_rows as (
    select e.id, e.meeting_id, e.room_id,
      exists (
        select 1 from public.ballots b
        where b.meeting_id = e.meeting_id and b.room_id = e.room_id
      ) or exists (
        select 1 from public.manual_ballots mb
        where mb.meeting_id = e.meeting_id and mb.room_id = e.room_id
      ) as voted
    from public.eligible_voters_snapshot e
    join public.meetings m on m.id = e.meeting_id
    where e.room_id in (select room_id from owner_rooms)
      and e.voter_type = 'owner'
      and m.status = 'published'
      and m.closed_at is null
      and m.ends_at > now()
  )
  select count(*) filter (where voted), count(*) filter (where not voted)
  into v_kept, v_updated
  from open_rows;

  if v_new is not null then
    update public.eligible_voters_snapshot e
    set profile_id = v_new
    from public.meetings m
    where m.id = e.meeting_id
      and e.voter_type = 'owner'
      and m.status = 'published'
      and m.closed_at is null
      and m.ends_at > now()
      and e.room_id in (
        select ro.room_id from public.room_owners ro
        where ro.owner_id = p_owner_id and ro.status = 'active'
          and ro.ends_at is null and ro.ownership_role = 'owner')
      and not exists (select 1 from public.ballots b where b.meeting_id = e.meeting_id and b.room_id = e.room_id)
      and not exists (select 1 from public.manual_ballots mb where mb.meeting_id = e.meeting_id and mb.room_id = e.room_id);

    -- Rooms with no row yet (the owner had no account at publish) get one,
    -- unless a proxy already holds the room.
    with added as (
      insert into public.eligible_voters_snapshot
        (meeting_id, room_id, profile_id, voter_type, ownership_percent, source)
      select m.id, r.id, v_new, 'owner', r.ownership_percent, 'owner_master'
      from public.meetings m
      cross join public.rooms r
      where m.status = 'published'
        and m.closed_at is null
        and m.ends_at > now()
        and r.active
        and r.id in (
          select ro.room_id from public.room_owners ro
          where ro.owner_id = p_owner_id and ro.status = 'active'
            and ro.ends_at is null and ro.ownership_role = 'owner')
        and not exists (
          select 1 from public.eligible_voters_snapshot e
          where e.meeting_id = m.id and e.room_id = r.id)
      on conflict (meeting_id, room_id) do nothing
      returning 1
    )
    select v_updated + count(*) into v_updated from added;
  else
    delete from public.eligible_voters_snapshot e
    using public.meetings m
    where m.id = e.meeting_id
      and e.voter_type = 'owner'
      and m.status = 'published'
      and m.closed_at is null
      and m.ends_at > now()
      and e.room_id in (
        select ro.room_id from public.room_owners ro
        where ro.owner_id = p_owner_id and ro.status = 'active'
          and ro.ends_at is null and ro.ownership_role = 'owner')
      and not exists (select 1 from public.ballots b where b.meeting_id = e.meeting_id and b.room_id = e.room_id)
      and not exists (select 1 from public.manual_ballots mb where mb.meeting_id = e.meeting_id and mb.room_id = e.room_id);
  end if;

  v_action := case
    when v_new is null then 'owner.profile_unlinked'
    when v_old is null then 'owner.profile_linked'
    else 'owner.profile_moved'
  end;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values (v_action, v_actor, 'owner', p_owner_id,
    jsonb_build_object(
      'source', 'admin',
      'reason', v_reason,
      'from_profile_id', v_old,
      'to_profile_id', v_new,
      'open_meeting_rows_changed', v_updated,
      'open_meeting_rows_kept_voted', v_kept));

  return jsonb_build_object(
    'action', v_action,
    'from_profile_id', v_old,
    'to_profile_id', v_new,
    'rows_changed', v_updated,
    'rows_kept_voted', v_kept);
end;
$$;

revoke all on function public.admin_set_owner_account(uuid, text, text) from public;
grant execute on function public.admin_set_owner_account(uuid, text, text) to authenticated;
