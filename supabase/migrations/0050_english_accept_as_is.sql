-- English after publishing (D020, user decision 2026-11-21): the Manager may
-- keep the English of a published meeting as it is instead of editing it.
-- With English written, that text is shown as it is; where English is
-- missing, pages show the Thai text (localized(), Thai prevails). Either way
-- the decision is recorded, and the overview stops counting the meeting.
create or replace function public.accept_meeting_english_as_is(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting record;
  v_missing integer;
begin
  if not public.has_app_role('admin') then
    raise exception 'MEETING_FORBIDDEN: Only the Manager decides on the English text.' using errcode = 'P0001';
  end if;

  select id, status, ends_at, title_en, english_checked_at into v_meeting
  from public.meetings where id = p_meeting_id for update;

  if v_meeting.id is null then
    raise exception 'MEETING_NOT_FOUND: Meeting not found.' using errcode = 'P0001';
  end if;

  if v_meeting.status <> 'published' then
    raise exception 'MEETING_NOT_PUBLISHED: Only a published meeting is kept as it is; a draft is checked before publishing.' using errcode = 'P0001';
  end if;

  -- Texts without English, which readers see in Thai.
  select (case when nullif(btrim(coalesce(v_meeting.title_en, '')), '') is null then 1 else 0 end)
    + (select count(*) from public.meeting_questions q
       where q.meeting_id = p_meeting_id and nullif(btrim(coalesce(q.question_text_en, '')), '') is null)
    + (select count(*) from public.meeting_choices c join public.meeting_questions q on q.id = c.question_id
       where q.meeting_id = p_meeting_id and not c.is_abstain and nullif(btrim(coalesce(c.choice_text_en, '')), '') is null)
  into v_missing;

  update public.meetings
  set english_checked_at = now(), english_checked_by = public.current_profile_id()
  where id = p_meeting_id;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values ('meeting.english_kept_as_is', public.current_profile_id(), 'meeting', p_meeting_id,
    jsonb_build_object('meeting_id', p_meeting_id, 'missing_english', v_missing));
end;
$$;

revoke all on function public.accept_meeting_english_as_is(uuid) from public, anon;
grant execute on function public.accept_meeting_english_as_is(uuid) to authenticated;
