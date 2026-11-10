-- Committee approval minimum and vote closing (D014).
--
-- committee_approvals now holds one row per approver. A result is published
-- (result_publications) when approvals for its snapshot reach the meeting's
-- required_approvals. Voting closes at ends_at, or earlier when close-voting
-- approvals reach the same minimum.
-- Errors are raised as 'RESULT_<CODE>: <message>' (errcode P0001).

alter table public.meetings
  add column required_approvals integer not null default 1,
  add column closed_at timestamptz,
  add constraint meetings_required_approvals_check check (required_approvals between 1 and 20);

-- One approval per approver per snapshot, instead of one per meeting.
drop index public.committee_approvals_one_result_per_meeting_idx;
alter table public.committee_approvals
  drop constraint committee_approvals_meeting_id_result_snapshot_id_key,
  add constraint committee_approvals_snapshot_approver_key unique (result_snapshot_id, approved_by);

create table public.result_publications (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings(id),
  result_snapshot_id uuid not null unique references public.result_snapshots(id),
  approvals_count integer not null,
  published_at timestamptz not null default now()
);

alter table public.result_publications enable row level security;

create policy "result_publications_authenticated_select"
on public.result_publications
for select
to authenticated
using (true);

-- Existing approved results stay published.
insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count, published_at)
select meeting_id, result_snapshot_id, count(*), min(approved_at)
from public.committee_approvals
group by meeting_id, result_snapshot_id;

-- Viewers see a snapshot once it is published, not after the first approval.
drop policy "result_snapshots_authenticated_approved_select" on public.result_snapshots;
create policy "result_snapshots_authenticated_published_select"
on public.result_snapshots
for select
to authenticated
using (
  exists (
    select 1 from public.result_publications publication
    where publication.result_snapshot_id = result_snapshots.id
  )
);

create table public.meeting_close_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  unique (meeting_id, approved_by)
);

alter table public.meeting_close_approvals enable row level security;

create policy "meeting_close_approvals_admin_select"
on public.meeting_close_approvals
for select
to authenticated
using (public.has_app_role('admin') or public.has_app_role('committee'));

create or replace function public.can_approve_as_committee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role('committee') or public.has_app_role('admin');
$$;

-- Queues result emails to active owners and approved residents (same rules as
-- the earlier app code), newest activity first. Skips recipients already queued.
create or replace function public.queue_result_approved_emails(p_meeting_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with recipients as (
    select lower(btrim(email)) as email, created_at as active_at
    from public.owners
    where active and email is not null and btrim(email) <> ''
    union all
    select lower(btrim(email)), created_at
    from public.profiles
    where approval_status = 'approved' and default_status = 'resident'
  ),
  latest as (
    select email, max(active_at) as active_at
    from recipients
    group by email
  )
  insert into public.email_logs (recipient_email, template_key, status)
  select l.email, 'result_approved:' || p_meeting_id, 'queued'
  from latest l
  where not exists (
    select 1 from public.email_logs e
    where e.template_key = 'result_approved:' || p_meeting_id
      and lower(e.recipient_email) = l.email
  )
  order by l.active_at desc;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.queue_result_approved_emails(uuid) from public;

-- Records one approver's approval of a result snapshot and publishes the
-- result when approvals reach the meeting's required_approvals.
create or replace function public.approve_result_snapshot(
  p_result_snapshot_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approver_id uuid := public.current_profile_id();
  v_meeting_id uuid;
  v_required integer;
  v_count integer;
  v_published boolean := false;
  v_approval_id uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can approve results.' using errcode = 'P0001';
  end if;

  select s.meeting_id, m.required_approvals into v_meeting_id, v_required
  from public.result_snapshots s
  join public.meetings m on m.id = s.meeting_id
  where s.id = p_result_snapshot_id;

  if v_meeting_id is null then
    raise exception 'RESULT_NOT_FOUND: Result snapshot not found.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.result_publications where meeting_id = v_meeting_id) then
    raise exception 'RESULT_ALREADY_PUBLISHED: This meeting already has a published result.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.committee_approvals
    where meeting_id = v_meeting_id and result_snapshot_id <> p_result_snapshot_id
  ) then
    raise exception 'RESULT_OTHER_SNAPSHOT: Another result snapshot of this meeting is already being approved.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.manual_ballots
    where meeting_id = v_meeting_id and identity_status = 'pending'
  ) then
    raise exception 'RESULT_PENDING_MANUAL_IDENTITY: Resolve pending manual vote identity records before approving.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.committee_approvals
    where result_snapshot_id = p_result_snapshot_id and approved_by = v_approver_id
  ) then
    raise exception 'RESULT_ALREADY_APPROVED: You already approved this result.' using errcode = 'P0001';
  end if;

  insert into public.committee_approvals (meeting_id, result_snapshot_id, approved_by, notes)
  values (v_meeting_id, p_result_snapshot_id, v_approver_id, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_approval_id;

  select count(*) into v_count
  from public.committee_approvals
  where result_snapshot_id = p_result_snapshot_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result_snapshot.approved', v_approver_id, 'committee_approval', v_approval_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'result_snapshot_id', p_result_snapshot_id,
      'approvals', v_count, 'required_approvals', v_required));

  if v_count >= v_required then
    insert into public.result_publications (meeting_id, result_snapshot_id, approvals_count)
    values (v_meeting_id, p_result_snapshot_id, v_count);
    perform public.queue_result_approved_emails(v_meeting_id);
    v_published := true;

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('result_snapshot.published', v_approver_id, 'result_snapshot', p_result_snapshot_id,
      jsonb_build_object('meeting_id', v_meeting_id, 'approvals', v_count));
  end if;

  return jsonb_build_object('approvals', v_count, 'required', v_required, 'published', v_published);
end;
$$;

revoke all on function public.approve_result_snapshot(uuid, text) from public;
grant execute on function public.approve_result_snapshot(uuid, text) to authenticated;

-- Records one approval to close voting early; closes the meeting when
-- approvals reach required_approvals.
create or replace function public.approve_close_voting(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approver_id uuid := public.current_profile_id();
  v_meeting record;
  v_count integer;
  v_closed boolean := false;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can close voting.' using errcode = 'P0001';
  end if;

  select id, status, ends_at, required_approvals into v_meeting
  from public.meetings where id = p_meeting_id
  for update;

  if v_meeting.id is null or v_meeting.status <> 'published' or now() > v_meeting.ends_at then
    raise exception 'RESULT_VOTING_NOT_OPEN: Voting is not open for this meeting.' using errcode = 'P0001';
  end if;

  insert into public.meeting_close_approvals (meeting_id, approved_by)
  values (p_meeting_id, v_approver_id)
  on conflict (meeting_id, approved_by) do nothing;

  if not found then
    raise exception 'RESULT_ALREADY_APPROVED: You already approved closing this meeting.' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.meeting_close_approvals where meeting_id = p_meeting_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_approved', v_approver_id, 'meeting', p_meeting_id,
    jsonb_build_object('approvals', v_count, 'required_approvals', v_meeting.required_approvals));

  if v_count >= v_meeting.required_approvals then
    update public.meetings set status = 'closed', closed_at = now() where id = p_meeting_id;
    v_closed := true;

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('meeting.closed_early', v_approver_id, 'meeting', p_meeting_id,
      jsonb_build_object('approvals', v_count));
  end if;

  return jsonb_build_object('approvals', v_count, 'required', v_meeting.required_approvals, 'closed', v_closed);
end;
$$;

revoke all on function public.approve_close_voting(uuid) from public;
grant execute on function public.approve_close_voting(uuid) to authenticated;

-- Data for the committee page: open meetings and results awaiting approval.
create or replace function public.committee_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Committee access only.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'open_meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'ends_at', m.ends_at,
        'required_approvals', m.required_approvals,
        'close_approvals', (select count(*) from public.meeting_close_approvals c where c.meeting_id = m.id),
        'approved_by_me', exists (select 1 from public.meeting_close_approvals c where c.meeting_id = m.id and c.approved_by = v_profile_id)
      ) order by m.ends_at)
      from public.meetings m
      where m.status = 'published' and now() between m.starts_at and m.ends_at
    ), '[]'::jsonb),
    'pending_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'snapshot_id', s.id,
        'meeting_id', m.id,
        'title', m.title,
        'generated_at', s.generated_at,
        'required_approvals', m.required_approvals,
        'approvals', (select count(*) from public.committee_approvals a where a.result_snapshot_id = s.id),
        'approved_by_me', exists (select 1 from public.committee_approvals a where a.result_snapshot_id = s.id and a.approved_by = v_profile_id),
        'payload', s.payload_json
      ) order by s.generated_at desc)
      from public.result_snapshots s
      join public.meetings m on m.id = s.meeting_id
      where not exists (select 1 from public.result_publications p where p.meeting_id = m.id)
        and s.id = (
          select s2.id from public.result_snapshots s2
          where s2.meeting_id = m.id
          order by s2.generated_at desc limit 1
        )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.committee_overview() from public;
grant execute on function public.committee_overview() to authenticated;
