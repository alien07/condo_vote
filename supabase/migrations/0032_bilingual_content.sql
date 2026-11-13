-- English versions of admin-typed content (D020, demo feedback item 6b).
--
-- A per-condo switch (condo_profiles.bilingual_documents) asks for English
-- next to the Thai text of meetings, agenda items, questions and choices.
-- English is written or drafted by machine translation, and the admin must
-- mark it checked before a meeting is published (the app checks at publish
-- time, not when saving a draft). English can be added or changed after
-- publishing; Thai stays locked as before, and such edits are audited.
-- Result snapshots copy the English text; older snapshots fall back to Thai.

alter table public.condo_profiles
  add column bilingual_documents boolean not null default false,
  add column project_name_en text,
  add column juristic_name_en text;

alter table public.meetings
  add column title_en text,
  add column location_en text,
  add column english_checked_at timestamptz,
  -- No foreign key, so embedding profiles from meetings stays unambiguous.
  add column english_checked_by uuid;

alter table public.meeting_questions
  add column agenda_title_en text,
  add column question_text_en text,
  add column legal_note_en text;

alter table public.meeting_choices
  add column choice_text_en text;

-- Saves the English text of one meeting. p_text:
-- { "meeting": {"title_en", "location_en"},
--   "questions": [{"id", "agenda_title_en", "question_text_en", "legal_note_en"}],
--   "choices": [{"id", "choice_text_en"}] }
-- Thai columns are never touched. Any change clears "checked" unless
-- p_checked is true; p_checked records who checked and when.
create or replace function public.save_meeting_english(
  p_meeting_id uuid,
  p_text jsonb,
  p_checked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_meeting record;
  v_changed integer := 0;
  v_rows integer;
  v_item jsonb;
begin
  if not public.has_app_role('admin') then
    raise exception 'MEETING_FORBIDDEN: Only admins edit meeting text.' using errcode = 'P0001';
  end if;

  select id, status into v_meeting from public.meetings where id = p_meeting_id for update;

  if v_meeting.id is null then
    raise exception 'MEETING_NOT_FOUND: Meeting not found.' using errcode = 'P0001';
  end if;

  update public.meetings
  set title_en = nullif(btrim(coalesce(p_text->'meeting'->>'title_en', '')), ''),
      location_en = nullif(btrim(coalesce(p_text->'meeting'->>'location_en', '')), '')
  where id = p_meeting_id
    and (title_en is distinct from nullif(btrim(coalesce(p_text->'meeting'->>'title_en', '')), '')
      or location_en is distinct from nullif(btrim(coalesce(p_text->'meeting'->>'location_en', '')), ''));
  get diagnostics v_rows = row_count;
  v_changed := v_changed + v_rows;

  for v_item in select * from jsonb_array_elements(coalesce(p_text->'questions', '[]'::jsonb)) loop
    update public.meeting_questions q
    set agenda_title_en = nullif(btrim(coalesce(v_item->>'agenda_title_en', '')), ''),
        question_text_en = nullif(btrim(coalesce(v_item->>'question_text_en', '')), ''),
        legal_note_en = nullif(btrim(coalesce(v_item->>'legal_note_en', '')), '')
    where q.id = (v_item->>'id')::uuid
      and q.meeting_id = p_meeting_id
      and (q.agenda_title_en is distinct from nullif(btrim(coalesce(v_item->>'agenda_title_en', '')), '')
        or q.question_text_en is distinct from nullif(btrim(coalesce(v_item->>'question_text_en', '')), '')
        or q.legal_note_en is distinct from nullif(btrim(coalesce(v_item->>'legal_note_en', '')), ''));
    get diagnostics v_rows = row_count;
    v_changed := v_changed + v_rows;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_text->'choices', '[]'::jsonb)) loop
    update public.meeting_choices c
    set choice_text_en = nullif(btrim(coalesce(v_item->>'choice_text_en', '')), '')
    from public.meeting_questions q
    where c.id = (v_item->>'id')::uuid
      and q.id = c.question_id
      and q.meeting_id = p_meeting_id
      and c.choice_text_en is distinct from nullif(btrim(coalesce(v_item->>'choice_text_en', '')), '');
    get diagnostics v_rows = row_count;
    v_changed := v_changed + v_rows;
  end loop;

  if p_checked then
    update public.meetings
    set english_checked_at = now(), english_checked_by = v_profile_id
    where id = p_meeting_id;
  elsif v_changed > 0 then
    update public.meetings
    set english_checked_at = null, english_checked_by = null
    where id = p_meeting_id;
  end if;

  insert into public.audit_logs (action, actor_profile_id, entity_type, entity_id, details_json)
  values (
    case when v_meeting.status = 'draft' then 'meeting.english_saved' else 'meeting.english_edited_after_publish' end,
    v_profile_id, 'meeting', p_meeting_id,
    jsonb_build_object('changed_rows', v_changed, 'checked', p_checked, 'status', v_meeting.status));

  return jsonb_build_object('changed_rows', v_changed, 'checked', p_checked);
end;
$$;

revoke all on function public.save_meeting_english(uuid, jsonb, boolean) from public;
grant execute on function public.save_meeting_english(uuid, jsonb, boolean) to authenticated;
