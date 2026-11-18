-- Agenda items and choices change only while their meeting is a draft
-- (2026-11-18). Before this, an admin could add, edit or delete agenda
-- items and choices of a published or closed meeting, while owners voted.
--
-- After publishing, only the English text may change (item 6b / D020:
-- edited through save_meeting_english and audited there).
--
-- The rule applies to signed-in users (the app). The service role (demo
-- seed, scripts) and migrations are not checked.

create or replace function public.guard_agenda_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_meetings uuid[];
  v_locked boolean;
  v_english_only text[];
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'meeting_questions' then
    v_meetings := array_remove(array[
      case when tg_op <> 'INSERT' then old.meeting_id end,
      case when tg_op <> 'DELETE' then new.meeting_id end
    ], null);
    v_english_only := array['agenda_title_en', 'question_text_en', 'legal_note_en'];
  else
    select array_agg(q.meeting_id) into v_meetings
    from public.meeting_questions q
    where q.id in (
      case when tg_op <> 'INSERT' then old.question_id end,
      case when tg_op <> 'DELETE' then new.question_id end
    );
    v_english_only := array['choice_text_en'];
  end if;

  select exists (
    select 1 from public.meetings m
    where m.id = any(v_meetings) and m.status <> 'draft'
  ) into v_locked;

  if not v_locked then
    return coalesce(new, old);
  end if;

  -- English text only: allowed after publishing.
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - v_english_only) = (to_jsonb(old) - v_english_only) then
    return new;
  end if;

  raise exception 'AGENDA_LOCKED: Agenda items and choices can only change while the meeting is a draft.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists meeting_questions_guard_change on public.meeting_questions;
create trigger meeting_questions_guard_change
before insert or update or delete on public.meeting_questions
for each row execute function public.guard_agenda_change();

drop trigger if exists meeting_choices_guard_change on public.meeting_choices;
create trigger meeting_choices_guard_change
before insert or update or delete on public.meeting_choices
for each row execute function public.guard_agenda_change();
