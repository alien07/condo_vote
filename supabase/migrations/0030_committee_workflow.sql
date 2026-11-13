-- Committee workflow (demo feedback items 10, 11 and 12).
--
-- 10. Closing voting early starts with a request: a committee member or an
--     admin proposes it with a reason and a time; committee members approve
--     or object (with a reason). The meeting's required_approvals closes
--     voting. The request fails once too few members are left to reach that
--     number. Approving without a request is no longer possible.
-- 11. committee_overview() returns who approved, who objected, and who has
--     not answered, for the "i" tip on the Committee page.
-- 12. A committee member can ask for a correction of a result, by category,
--     with a severity level. The admin may raise the level (never lower it)
--     and must answer. While a request is open, the admin may generate the
--     result again; approvals then start from 0 on the new snapshot, and
--     members who approved the old one are emailed. A high-level request
--     needs every active committee member to approve the result.
-- Errors are raised as 'RESULT_<CODE>: <message>' (errcode P0001).

-- Active committee members -------------------------------------------------------

-- Members who can answer: active, in their term, linked to an account with the
-- committee role.
create or replace function public.active_committee_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct cm.profile_id
  from public.committee_members cm
  join public.app_roles r on r.profile_id = cm.profile_id and r.role = 'committee'
  where cm.active
    and cm.profile_id is not null
    and (cm.term_starts_at is null or cm.term_starts_at <= current_date)
    and (cm.term_ends_at is null or cm.term_ends_at >= current_date);
$$;

revoke all on function public.active_committee_profile_ids() from public;

-- Close-early requests -----------------------------------------------------------

create table public.meeting_close_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  proposed_by uuid not null references public.profiles(id),
  reason text not null,
  -- null: close as soon as approved.
  close_at timestamptz,
  original_ends_at timestamptz not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint meeting_close_requests_status_check
    check (status in ('open', 'approved', 'failed', 'cancelled', 'lapsed')),
  constraint meeting_close_requests_reason_check check (btrim(reason) <> '')
);

-- One open request per meeting.
create unique index meeting_close_requests_one_open_idx
on public.meeting_close_requests(meeting_id) where status = 'open';

create table public.meeting_close_request_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.meeting_close_requests(id),
  answered_by uuid not null references public.profiles(id),
  answer text not null,
  reason text,
  answered_at timestamptz not null default now(),
  constraint meeting_close_request_answers_answer_check check (answer in ('approve', 'object')),
  constraint meeting_close_request_answers_reason_check
    check (answer = 'approve' or btrim(coalesce(reason, '')) <> ''),
  unique (request_id, answered_by)
);

alter table public.meeting_close_requests enable row level security;
alter table public.meeting_close_request_answers enable row level security;

-- Read by admin and committee; written only through the functions below.
create policy "meeting_close_requests_committee_select"
on public.meeting_close_requests for select to authenticated
using (public.can_approve_as_committee());

create policy "meeting_close_request_answers_committee_select"
on public.meeting_close_request_answers for select to authenticated
using (public.can_approve_as_committee());

-- Owners see that voting closes early (the time only, not who or why).
create or replace function public.meeting_early_close(p_meeting_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select r.close_at
  from public.meeting_close_requests r
  where r.meeting_id = p_meeting_id and r.status = 'approved' and r.close_at > now()
  order by r.ended_at desc
  limit 1;
$$;

revoke all on function public.meeting_early_close(uuid) from public;
grant execute on function public.meeting_early_close(uuid) to authenticated;

create or replace function public.queue_staff_email(p_profile_id uuid, p_template_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.email_logs (recipient_email, template_key, status, language)
  select lower(btrim(p.email)), p_template_key, 'queued', p.preferred_language
  from public.profiles p
  where p.id = p_profile_id and p.email is not null and btrim(p.email) <> '';
$$;

revoke all on function public.queue_staff_email(uuid, text) from public;

-- Decides an open request: approved (and closes voting), failed, or still open.
create or replace function public.evaluate_close_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.meeting_close_requests%rowtype;
  v_meeting record;
  v_members integer;
  v_approvals integer;
  v_answered integer;
  v_status text := 'open';
begin
  select * into v_request from public.meeting_close_requests where id = p_request_id for update;

  if v_request.status <> 'open' then
    return v_request.status;
  end if;

  select id, status, ends_at, required_approvals into v_meeting
  from public.meetings where id = v_request.meeting_id for update;

  if v_meeting.status <> 'published' or now() > v_meeting.ends_at then
    update public.meeting_close_requests set status = 'lapsed', ended_at = now() where id = p_request_id;
    return 'lapsed';
  end if;

  select count(*) into v_members from public.active_committee_profile_ids();
  select count(*) filter (where a.answer = 'approve'),
         count(*) filter (where a.answered_by in (select public.active_committee_profile_ids()))
  into v_approvals, v_answered
  from public.meeting_close_request_answers a
  where a.request_id = p_request_id;

  if v_approvals >= v_meeting.required_approvals then
    v_status := 'approved';
    update public.meeting_close_requests set status = 'approved', ended_at = now() where id = p_request_id;

    if v_request.close_at is null or v_request.close_at <= now() then
      update public.meetings set status = 'closed', closed_at = now() where id = v_request.meeting_id;
    else
      update public.meetings set ends_at = v_request.close_at where id = v_request.meeting_id;
    end if;

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('meeting.closed_early', public.current_profile_id(), 'meeting', v_request.meeting_id,
      jsonb_build_object('request_id', p_request_id, 'approvals', v_approvals,
        'close_at', coalesce(v_request.close_at, now()), 'original_ends_at', v_request.original_ends_at));
  elsif v_approvals + (v_members - v_answered) < v_meeting.required_approvals then
    v_status := 'failed';
    update public.meeting_close_requests set status = 'failed', ended_at = now() where id = p_request_id;
    perform public.queue_staff_email(v_request.proposed_by, 'close_request_failed:' || v_request.meeting_id);

    insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
    values ('meeting.close_request_failed', public.current_profile_id(), 'meeting_close_request', p_request_id,
      jsonb_build_object('meeting_id', v_request.meeting_id, 'approvals', v_approvals,
        'members', v_members, 'answered', v_answered));
  end if;

  return v_status;
end;
$$;

revoke all on function public.evaluate_close_request(uuid) from public;

create or replace function public.propose_close_voting(
  p_meeting_id uuid,
  p_reason text,
  p_close_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting record;
  v_request_id uuid;
  v_status text;
  v_member uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can propose closing voting.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for closing early.' using errcode = 'P0001';
  end if;

  select id, status, starts_at, ends_at into v_meeting
  from public.meetings where id = p_meeting_id for update;

  if v_meeting.id is null or v_meeting.status <> 'published' or now() > v_meeting.ends_at then
    raise exception 'RESULT_VOTING_NOT_OPEN: Voting is not open for this meeting.' using errcode = 'P0001';
  end if;

  if p_close_at is not null
     and (p_close_at <= now() or p_close_at >= v_meeting.ends_at or p_close_at <= v_meeting.starts_at) then
    raise exception 'RESULT_CLOSE_TIME: The close time must be in the future, after the meeting starts and before the set end time.' using errcode = 'P0001';
  end if;

  -- A request whose meeting has ended does not block a new one.
  update public.meeting_close_requests r
  set status = 'lapsed', ended_at = now()
  where r.meeting_id = p_meeting_id and r.status = 'open'
    and exists (select 1 from public.meetings m where m.id = r.meeting_id and (m.status <> 'published' or now() > m.ends_at));

  if exists (select 1 from public.meeting_close_requests where meeting_id = p_meeting_id and status = 'open') then
    raise exception 'RESULT_REQUEST_OPEN: This meeting already has an open request to close early.' using errcode = 'P0001';
  end if;

  insert into public.meeting_close_requests (meeting_id, proposed_by, reason, close_at, original_ends_at)
  values (p_meeting_id, v_profile_id, btrim(p_reason), p_close_at, v_meeting.ends_at)
  returning id into v_request_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_requested', v_profile_id, 'meeting_close_request', v_request_id,
    jsonb_build_object('meeting_id', p_meeting_id, 'reason', btrim(p_reason), 'close_at', p_close_at));

  -- The proposal counts as the proposer's approval when they are a member.
  if v_profile_id in (select public.active_committee_profile_ids()) then
    insert into public.meeting_close_request_answers (request_id, answered_by, answer)
    values (v_request_id, v_profile_id, 'approve');
  end if;

  for v_member in select public.active_committee_profile_ids() loop
    if v_member <> v_profile_id then
      perform public.queue_staff_email(v_member, 'close_request:' || p_meeting_id);
    end if;
  end loop;

  v_status := public.evaluate_close_request(v_request_id);

  return jsonb_build_object('request_id', v_request_id, 'status', v_status);
end;
$$;

revoke all on function public.propose_close_voting(uuid, text, timestamptz) from public;
grant execute on function public.propose_close_voting(uuid, text, timestamptz) to authenticated;

create or replace function public.answer_close_request(
  p_request_id uuid,
  p_answer text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request public.meeting_close_requests%rowtype;
  v_status text;
begin
  if v_profile_id is null or v_profile_id not in (select public.active_committee_profile_ids()) then
    raise exception 'RESULT_FORBIDDEN: Only active committee members can answer a request to close early.' using errcode = 'P0001';
  end if;

  if p_answer not in ('approve', 'object') then
    raise exception 'RESULT_INVALID_ANSWER: Answer approve or object.' using errcode = 'P0001';
  end if;

  if p_answer = 'object' and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for objecting.' using errcode = 'P0001';
  end if;

  select * into v_request from public.meeting_close_requests where id = p_request_id;

  if v_request.id is null or public.evaluate_close_request(p_request_id) <> 'open' then
    raise exception 'RESULT_REQUEST_CLOSED: This request has ended.' using errcode = 'P0001';
  end if;

  -- A member may change their answer while the request is open.
  insert into public.meeting_close_request_answers (request_id, answered_by, answer, reason)
  values (p_request_id, v_profile_id, p_answer, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (request_id, answered_by)
  do update set answer = excluded.answer, reason = excluded.reason, answered_at = now();

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.close_request_answered', v_profile_id, 'meeting_close_request', p_request_id,
    jsonb_build_object('meeting_id', v_request.meeting_id, 'answer', p_answer,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  v_status := public.evaluate_close_request(p_request_id);

  return jsonb_build_object('request_id', p_request_id, 'status', v_status);
end;
$$;

revoke all on function public.answer_close_request(uuid, text, text) from public;
grant execute on function public.answer_close_request(uuid, text, text) to authenticated;

create or replace function public.cancel_close_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  update public.meeting_close_requests
  set status = 'cancelled', ended_at = now()
  where id = p_request_id and status = 'open' and proposed_by = v_profile_id;

  if not found then
    raise exception 'RESULT_FORBIDDEN: Only the proposer can cancel an open request.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id)
  values ('meeting.close_request_cancelled', v_profile_id, 'meeting_close_request', p_request_id);
end;
$$;

revoke all on function public.cancel_close_request(uuid) from public;
grant execute on function public.cancel_close_request(uuid) to authenticated;

-- No approving to close without a request any more.
revoke execute on function public.approve_close_voting(uuid) from authenticated;

-- Correction requests --------------------------------------------------------------

create table public.result_correction_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  result_snapshot_id uuid not null references public.result_snapshots(id),
  requested_by uuid not null references public.profiles(id),
  category text not null,
  level text not null,
  reason text not null,
  legal_reference text,
  status text not null default 'open',
  answer text,
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  level_changed_by uuid references public.profiles(id),
  level_change_reason text,
  level_changed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint result_correction_requests_category_check
    check (category in ('wording', 'room_data', 'voting_rights', 'paper_ballot', 'pass_rule', 'other')),
  constraint result_correction_requests_level_check check (level in ('low', 'medium', 'high')),
  constraint result_correction_requests_status_check check (status in ('open', 'fixed', 'no_change')),
  constraint result_correction_requests_reason_check check (btrim(reason) <> ''),
  constraint result_correction_requests_high_reference_check
    check (level <> 'high' or btrim(coalesce(legal_reference, '')) <> '')
);

alter table public.result_correction_requests enable row level security;

create policy "result_correction_requests_committee_select"
on public.result_correction_requests for select to authenticated
using (public.can_approve_as_committee());

create or replace function public.correction_default_level(p_category text)
returns text
language sql
immutable
as $$
  select case p_category
    when 'wording' then 'low'
    when 'pass_rule' then 'high'
    else 'medium'  -- room data, voting rights, paper ballots, and "other"
  end;
$$;

create or replace function public.request_result_correction(
  p_result_snapshot_id uuid,
  p_category text,
  p_reason text,
  p_legal_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting_id uuid;
  v_level text;
  v_request_id uuid;
  v_admin uuid;
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Only committee members or admins can request a correction.' using errcode = 'P0001';
  end if;

  if p_category not in ('wording', 'room_data', 'voting_rights', 'paper_ballot', 'pass_rule', 'other') then
    raise exception 'RESULT_INVALID_CATEGORY: Choose what needs correcting.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Describe what is wrong.' using errcode = 'P0001';
  end if;

  v_level := public.correction_default_level(p_category);

  if v_level = 'high' and btrim(coalesce(p_legal_reference, '')) = '' then
    raise exception 'RESULT_REFERENCE_REQUIRED: Give the legal or by-law reference.' using errcode = 'P0001';
  end if;

  select s.meeting_id into v_meeting_id
  from public.result_snapshots s
  where s.id = p_result_snapshot_id
    and not exists (select 1 from public.result_publications p where p.meeting_id = s.meeting_id)
    and s.id = (select s2.id from public.result_snapshots s2 where s2.meeting_id = s.meeting_id
                order by s2.generated_at desc limit 1);

  if v_meeting_id is null then
    raise exception 'RESULT_NOT_PENDING: Only the latest unpublished result can be corrected.' using errcode = 'P0001';
  end if;

  insert into public.result_correction_requests
    (meeting_id, result_snapshot_id, requested_by, category, level, reason, legal_reference)
  values (v_meeting_id, p_result_snapshot_id, v_profile_id, p_category, v_level, btrim(p_reason),
    nullif(btrim(coalesce(p_legal_reference, '')), ''))
  returning id into v_request_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result.correction_requested', v_profile_id, 'result_correction_request', v_request_id,
    jsonb_build_object('meeting_id', v_meeting_id, 'result_snapshot_id', p_result_snapshot_id,
      'category', p_category, 'level', v_level));

  for v_admin in select profile_id from public.app_roles where role = 'admin' loop
    perform public.queue_staff_email(v_admin, 'result_correction:' || v_meeting_id);
  end loop;

  return jsonb_build_object('request_id', v_request_id, 'level', v_level);
end;
$$;

revoke all on function public.request_result_correction(uuid, text, text, text) from public;
grant execute on function public.request_result_correction(uuid, text, text, text) to authenticated;

-- The admin may raise the level, never lower it, with a reason.
create or replace function public.raise_correction_level(
  p_request_id uuid,
  p_level text,
  p_reason text,
  p_legal_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request public.result_correction_requests%rowtype;
  v_rank jsonb := '{"low": 1, "medium": 2, "high": 3}';
begin
  if not public.has_app_role('admin') then
    raise exception 'RESULT_FORBIDDEN: Only admins change the level.' using errcode = 'P0001';
  end if;

  select * into v_request from public.result_correction_requests where id = p_request_id for update;

  if v_request.id is null or v_request.status <> 'open' then
    raise exception 'RESULT_REQUEST_CLOSED: This request has been answered.' using errcode = 'P0001';
  end if;

  if p_level not in ('low', 'medium', 'high') or (v_rank->>p_level)::int <= (v_rank->>v_request.level)::int then
    raise exception 'RESULT_LEVEL_DOWN: The level can only go up.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Give a reason for the new level.' using errcode = 'P0001';
  end if;

  if p_level = 'high'
     and btrim(coalesce(nullif(btrim(coalesce(p_legal_reference, '')), ''), v_request.legal_reference, '')) = '' then
    raise exception 'RESULT_REFERENCE_REQUIRED: Give the legal or by-law reference.' using errcode = 'P0001';
  end if;

  update public.result_correction_requests
  set level = p_level,
      legal_reference = coalesce(nullif(btrim(coalesce(p_legal_reference, '')), ''), legal_reference),
      level_changed_by = v_profile_id,
      level_change_reason = btrim(p_reason),
      level_changed_at = now()
  where id = p_request_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result.correction_level_raised', v_profile_id, 'result_correction_request', p_request_id,
    jsonb_build_object('from', v_request.level, 'to', p_level, 'reason', btrim(p_reason)));
end;
$$;

revoke all on function public.raise_correction_level(uuid, text, text, text) from public;
grant execute on function public.raise_correction_level(uuid, text, text, text) to authenticated;

-- The admin answers every request; the requester cannot answer their own.
create or replace function public.answer_correction_request(
  p_request_id uuid,
  p_status text,
  p_answer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request public.result_correction_requests%rowtype;
begin
  if not public.has_app_role('admin') then
    raise exception 'RESULT_FORBIDDEN: Only admins answer correction requests.' using errcode = 'P0001';
  end if;

  if p_status not in ('fixed', 'no_change') then
    raise exception 'RESULT_INVALID_ANSWER: Answer fixed or no change needed.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_answer, '')) = '' then
    raise exception 'RESULT_REASON_REQUIRED: Explain the answer.' using errcode = 'P0001';
  end if;

  select * into v_request from public.result_correction_requests where id = p_request_id for update;

  if v_request.id is null or v_request.status <> 'open' then
    raise exception 'RESULT_REQUEST_CLOSED: This request has been answered.' using errcode = 'P0001';
  end if;

  if v_request.requested_by = v_profile_id then
    raise exception 'RESULT_OWN_REQUEST: Someone else must answer your own request.' using errcode = 'P0001';
  end if;

  update public.result_correction_requests
  set status = p_status, answer = btrim(p_answer), answered_by = v_profile_id, answered_at = now()
  where id = p_request_id;

  perform public.queue_staff_email(v_request.requested_by, 'result_correction_answered:' || v_request.meeting_id);

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('result.correction_answered', v_profile_id, 'result_correction_request', p_request_id,
    jsonb_build_object('status', p_status, 'answer', btrim(p_answer)));
end;
$$;

revoke all on function public.answer_correction_request(uuid, text, text) from public;
grant execute on function public.answer_correction_request(uuid, text, text) to authenticated;

-- Generating again ------------------------------------------------------------------

-- A new snapshot is allowed after approvals only while a correction request on
-- the latest snapshot is open, and never once the result is published.
create or replace function public.prevent_result_snapshot_change_after_approval()
returns trigger
language plpgsql
as $$
declare
  v_latest uuid;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.result_publications where meeting_id = new.meeting_id) then
      raise exception 'Cannot generate result snapshots after the result is published.';
    end if;

    select id into v_latest
    from public.result_snapshots
    where meeting_id = new.meeting_id
    order by generated_at desc
    limit 1;

    if v_latest is not null
       and exists (select 1 from public.committee_approvals where result_snapshot_id = v_latest)
       and not exists (
         select 1 from public.result_correction_requests
         where result_snapshot_id = v_latest and status = 'open'
       ) then
      raise exception 'Cannot generate result snapshots after committee approval.';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from public.committee_approvals
    where result_snapshot_id = old.id
  ) then
    raise exception 'Approved result snapshots are immutable.';
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;

-- Members who approved the previous snapshot are asked to review again.
create or replace function public.queue_review_again_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous uuid;
  v_approver uuid;
begin
  select id into v_previous
  from public.result_snapshots
  where meeting_id = new.meeting_id and id <> new.id
  order by generated_at desc
  limit 1;

  if v_previous is null then
    return new;
  end if;

  for v_approver in
    select distinct approved_by from public.committee_approvals where result_snapshot_id = v_previous
  loop
    perform public.queue_staff_email(v_approver, 'result_review_again:' || new.meeting_id);
  end loop;

  return new;
end;
$$;

create trigger result_snapshots_queue_review_again
after insert on public.result_snapshots
for each row execute function public.queue_review_again_emails();

-- Approving a result -----------------------------------------------------------------

-- Only the latest snapshot can be approved (older ones keep their approvals for
-- audit). A high-level correction request needs every active member.
create or replace function public.result_required_approvals(p_meeting_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.result_correction_requests r
      where r.meeting_id = p_meeting_id and r.level = 'high' and r.status <> 'no_change'
    )
    then greatest(m.required_approvals, (select count(*)::int from public.active_committee_profile_ids()))
    else m.required_approvals
  end
  from public.meetings m
  where m.id = p_meeting_id;
$$;

revoke all on function public.result_required_approvals(uuid) from public;
grant execute on function public.result_required_approvals(uuid) to authenticated;

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

  select s.meeting_id into v_meeting_id
  from public.result_snapshots s
  where s.id = p_result_snapshot_id;

  if v_meeting_id is null then
    raise exception 'RESULT_NOT_FOUND: Result snapshot not found.' using errcode = 'P0001';
  end if;

  perform 1 from public.meetings where id = v_meeting_id for update;

  if exists (select 1 from public.result_publications where meeting_id = v_meeting_id) then
    raise exception 'RESULT_ALREADY_PUBLISHED: This meeting already has a published result.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.result_snapshots
    where meeting_id = v_meeting_id
      and generated_at > (select generated_at from public.result_snapshots where id = p_result_snapshot_id)
  ) then
    raise exception 'RESULT_OTHER_SNAPSHOT: A newer result of this meeting was generated; approve that one.' using errcode = 'P0001';
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

  v_required := public.result_required_approvals(v_meeting_id);

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

-- Committee page data ------------------------------------------------------------------

create or replace function public.committee_people(p_profile_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', p.id,
    'name', coalesce(cm.full_name, p.full_name),
    'position', cm.position_title
  ) order by cm.display_order nulls last, p.full_name), '[]'::jsonb)
  from public.profiles p
  left join lateral (
    select full_name, position_title, display_order
    from public.committee_members c
    where c.profile_id = p.id and c.active
    order by c.display_order
    limit 1
  ) cm on true
  where p.id = any(p_profile_ids);
$$;

revoke all on function public.committee_people(uuid[]) from public;

create or replace function public.committee_person_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select cm.full_name from public.committee_members cm
     where cm.profile_id = p_profile_id and cm.active order by cm.display_order limit 1),
    (select p.full_name from public.profiles p where p.id = p_profile_id)
  );
$$;

revoke all on function public.committee_person_name(uuid) from public;

create or replace function public.committee_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_members uuid[];
begin
  if not public.can_approve_as_committee() then
    raise exception 'RESULT_FORBIDDEN: Committee access only.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into v_members from public.active_committee_profile_ids() id;

  return jsonb_build_object(
    'is_member', v_profile_id = any(v_members),
    'members', public.committee_people(v_members),
    'open_meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'ends_at', m.ends_at,
        'required_approvals', m.required_approvals,
        'request', (
          select jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'close_at', r.close_at,
            'created_at', r.created_at,
            'proposed_by', r.proposed_by,
            'proposed_by_me', r.proposed_by = v_profile_id,
            'proposer', public.committee_person_name(r.proposed_by),
            'my_answer', (select a.answer from public.meeting_close_request_answers a
                          where a.request_id = r.id and a.answered_by = v_profile_id),
            'answers', coalesce((
              select jsonb_agg(jsonb_build_object(
                'profile_id', a.answered_by,
                'name', public.committee_person_name(a.answered_by),
                'answer', a.answer,
                'reason', a.reason,
                'answered_at', a.answered_at
              ) order by a.answered_at)
              from public.meeting_close_request_answers a
              where a.request_id = r.id
            ), '[]'::jsonb)
          )
          from public.meeting_close_requests r
          where r.meeting_id = m.id and r.status = 'open'
          limit 1
        ),
        'closes_early_at', (
          select r.close_at from public.meeting_close_requests r
          where r.meeting_id = m.id and r.status = 'approved' and r.close_at > now()
          order by r.ended_at desc limit 1
        )
      ) order by m.ends_at)
      from public.meetings m
      where m.status = 'published'
        and now() <= m.ends_at
        and now() >= coalesce(least(m.advance_starts_at, m.starts_at), m.starts_at)
    ), '[]'::jsonb),
    'pending_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'snapshot_id', s.id,
        'meeting_id', m.id,
        'title', m.title,
        'generated_at', s.generated_at,
        'required_approvals', public.result_required_approvals(m.id),
        'approvals', (select count(*) from public.committee_approvals a where a.result_snapshot_id = s.id),
        'approved_by_me', exists (select 1 from public.committee_approvals a where a.result_snapshot_id = s.id and a.approved_by = v_profile_id),
        'approval_list', coalesce((
          select jsonb_agg(jsonb_build_object(
            'profile_id', a.approved_by,
            'name', public.committee_person_name(a.approved_by),
            'approved_at', a.approved_at,
            'notes', a.notes
          ) order by a.approved_at)
          from public.committee_approvals a
          where a.result_snapshot_id = s.id
        ), '[]'::jsonb),
        'corrections', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id,
            'result_snapshot_id', c.result_snapshot_id,
            'category', c.category,
            'level', c.level,
            'reason', c.reason,
            'legal_reference', c.legal_reference,
            'status', c.status,
            'answer', c.answer,
            'answered_at', c.answered_at,
            'level_change_reason', c.level_change_reason,
            'level_changed_at', c.level_changed_at,
            'requested_by_me', c.requested_by = v_profile_id,
            'requester', (select p.full_name from public.profiles p where p.id = c.requested_by),
            'created_at', c.created_at
          ) order by c.created_at desc)
          from public.result_correction_requests c
          where c.meeting_id = m.id
        ), '[]'::jsonb),
        'previous_payload', (
          select s2.payload_json from public.result_snapshots s2
          where s2.meeting_id = m.id and s2.generated_at < s.generated_at
          order by s2.generated_at desc limit 1
        ),
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
