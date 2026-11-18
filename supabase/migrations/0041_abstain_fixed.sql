-- Abstain is a fixed choice (2026-11-18, amends D017).
--
-- Before: every new agenda item got an "Abstain" choice from a trigger
-- (0021), and the admin could rename it. A renamed Abstain still worked as
-- Abstain (it cannot be combined with other choices), but voters and the
-- office could no longer tell.
--
-- Now:
-- - New agenda items get no Abstain. The admin ticks "has Abstain" on the
--   agenda item when it should have one; the app adds the choice.
-- - Abstain's text is always "Abstain" (shown as "งดออกเสียง" in Thai,
--   lib/i18n/choice.ts) and it is always last.
-- - Signed-in users (the app) cannot change it; the database owner (seed,
--   migrations) gets the fixed text silently.
-- - Existing Abstain choices that were renamed get the fixed text back. The
--   choice keeps its id, so saved ballots and results do not change.

drop trigger if exists meeting_questions_default_abstain on public.meeting_questions;
drop function if exists public.add_default_abstain_choice();

create or replace function public.fix_abstain_choice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_abstain then
    if coalesce(auth.role(), '') = 'authenticated'
      and (
        not new.is_abstain
        or new.choice_text is distinct from old.choice_text
        or new.choice_text_en is distinct from old.choice_text_en
        or new.display_order is distinct from old.display_order
      ) then
      raise exception 'ABSTAIN_FIXED: The Abstain choice cannot be changed. Turn it on or off on the agenda item.'
        using errcode = 'P0001';
    end if;

    new.is_abstain := true;
  end if;

  if new.is_abstain then
    new.choice_text := 'Abstain';
    new.choice_text_en := 'Abstain';
    new.display_order := 999;
  end if;

  return new;
end;
$$;

-- Runs before meeting_choices_guard_change (names sort), so the lock check
-- sees the fixed values.
drop trigger if exists meeting_choices_abstain_fixed on public.meeting_choices;
create trigger meeting_choices_abstain_fixed
before insert or update on public.meeting_choices
for each row execute function public.fix_abstain_choice();

-- Renamed Abstain choices get the fixed text back.
update public.meeting_choices
set choice_text = 'Abstain', choice_text_en = 'Abstain', display_order = 999
where is_abstain
  and (
    choice_text is distinct from 'Abstain'
    or choice_text_en is distinct from 'Abstain'
    or display_order is distinct from 999
  );
