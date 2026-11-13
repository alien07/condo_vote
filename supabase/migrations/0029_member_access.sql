-- Member access (demo feedback items 1 and 4).
--
-- Published results are for approved members only. Before this, any signed-in
-- account could read them, and anyone with a Google account becomes a signed-in
-- (pending) account. Pending and rejected accounts now see nothing but their
-- own profile, the privacy notice, help, and the waiting/rejected notice.
--
-- my_member_access() tells the app which menus to show, and why an owner has
-- no ballot right now (rooms held by a proxy).
-- verify_result_reference() keeps the "verify this reference" check working:
-- it returns the hash and publication, never the result itself.

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.current_profile_id()
      and p.approval_status = 'approved'
  )
  or exists (
    select 1
    from public.app_roles r
    where r.profile_id = public.current_profile_id()
      and r.role in ('admin', 'committee', 'system_admin')
  );
$$;

revoke execute on function public.is_approved_member() from public;
grant execute on function public.is_approved_member() to authenticated;

-- Results and who approved them ---------------------------------------------------

drop policy "result_snapshots_authenticated_published_select" on public.result_snapshots;
create policy "result_snapshots_member_published_select"
on public.result_snapshots
for select
to authenticated
using (
  public.is_approved_member()
  and exists (
    select 1 from public.result_publications publication
    where publication.result_snapshot_id = result_snapshots.id
  )
);

drop policy "result_publications_authenticated_select" on public.result_publications;
create policy "result_publications_member_select"
on public.result_publications
for select
to authenticated
using (public.is_approved_member());

drop policy "committee_approvals_authenticated_select" on public.committee_approvals;
create policy "committee_approvals_member_select"
on public.committee_approvals
for select
to authenticated
using (public.is_approved_member());

drop policy "result_documents_select" on public.result_documents;
create policy "result_documents_select"
on public.result_documents
for select
to authenticated
using (
  public.can_approve_as_committee()
  or (
    kind = 'summary'
    and public.is_approved_member()
    and exists (
      select 1 from public.result_publications p
      where p.result_snapshot_id = result_documents.result_snapshot_id
    )
  )
);

drop policy "result_documents_files_select" on storage.objects;
create policy "result_documents_files_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'result-documents'
  and (
    public.can_approve_as_committee()
    or (
      split_part(name, '/', 2) like 'summary-%'
      and public.is_approved_member()
      and exists (
        select 1 from public.result_publications p
        where p.result_snapshot_id::text = split_part(name, '/', 1)
      )
    )
  )
);

-- Verify a printed or forwarded result ---------------------------------------------

create or replace function public.verify_result_reference(p_snapshot_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'meeting_title', m.title,
    'generated_at', s.generated_at,
    'payload_sha256', s.payload_sha256,
    'published_at', p.published_at,
    'approvals_count', p.approvals_count
  )
  from public.result_snapshots s
  join public.result_publications p on p.result_snapshot_id = s.id
  join public.meetings m on m.id = s.meeting_id
  where s.id = p_snapshot_id
    and public.current_profile_id() is not null;
$$;

revoke execute on function public.verify_result_reference(uuid) from public;
grant execute on function public.verify_result_reference(uuid) to authenticated;

-- What the signed-in person can open -------------------------------------------------

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

  v_approved := v_profile.approval_status = 'approved';

  select exists (
    select 1
    from public.room_owners ro
    join public.owners o on o.id = ro.owner_id
    where ro.status = 'active'
      and lower(o.email) = lower(v_profile.email)
  ) into v_owns_room;

  select exists (
    select 1 from public.eligible_voters_snapshot e where e.profile_id = v_profile.id
  ) into v_has_ballot_right;

  -- Rooms of this owner that a proxy holds in a meeting that is still open.
  select coalesce(jsonb_agg(jsonb_build_object(
      'room_number', r.room_number,
      'meeting_title', m.title,
      'proxy_name', proxy.full_name,
      'ends_at', m.ends_at
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
        and lower(o.email) = lower(v_profile.email)
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

revoke execute on function public.my_member_access() from public;
grant execute on function public.my_member_access() to authenticated;
