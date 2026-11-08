-- Multiple choice and default Abstain choice (D017).

alter table public.meeting_choices
  add column is_abstain boolean not null default false;

-- At most one Abstain choice per question.
create unique index meeting_choices_one_abstain_per_question
  on public.meeting_choices (question_id)
  where is_abstain;

alter table public.meeting_questions
  add column max_choices integer,
  add constraint meeting_questions_max_choices_check
    check (max_choices is null or max_choices >= 1);

-- Every new question starts with an Abstain choice. Admin can delete it.
create or replace function public.add_default_abstain_choice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.meeting_choices (question_id, choice_text, display_order, is_abstain)
  values (new.id, 'Abstain', 999, true);

  return new;
end;
$$;

create trigger meeting_questions_default_abstain
after insert on public.meeting_questions
for each row execute function public.add_default_abstain_choice();

-- Questions of draft meetings get the default too. Published and closed
-- meetings keep their choices unchanged.
insert into public.meeting_choices (question_id, choice_text, display_order, is_abstain)
select q.id, 'Abstain', 999, true
from public.meeting_questions q
join public.meetings m on m.id = q.meeting_id
where m.status = 'draft'
  and not exists (
    select 1 from public.meeting_choices c
    where c.question_id = q.id and c.is_abstain
  );

-- Answer validation: Abstain is exclusive, and max_choices limits multiple
-- choice questions.
create or replace function public.vote_normalize_answers(
  p_meeting_id uuid,
  p_answers jsonb
)
returns table (question_id uuid, choice_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_question record;
  v_selected uuid[];
  v_count integer;
  v_has_abstain boolean;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'VOTE_INVALID_ANSWERS: Answers must be a list.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) as item
    where not exists (
      select 1 from public.meeting_questions q
      where q.meeting_id = p_meeting_id
        and q.id::text = item->>'question_id'
    )
  ) then
    raise exception 'VOTE_INVALID_ANSWERS: An answer does not belong to this meeting.' using errcode = 'P0001';
  end if;

  for v_question in
    select q.id, q.question_text, q.question_type, q.required, q.max_choices
    from public.meeting_questions q
    where q.meeting_id = p_meeting_id
    order by q.display_order, q.created_at
  loop
    select coalesce(array_agg(distinct choice::uuid), '{}')
    into v_selected
    from jsonb_array_elements(p_answers) as item,
      jsonb_array_elements_text(coalesce(item->'choice_ids', '[]'::jsonb)) as choice
    where item->>'question_id' = v_question.id::text;

    v_count := coalesce(array_length(v_selected, 1), 0);

    if v_count = 0 and v_question.required then
      raise exception 'VOTE_INVALID_ANSWERS: % is required.', v_question.question_text using errcode = 'P0001';
    end if;

    if v_question.question_type = 'single_choice' and v_count > 1 then
      raise exception 'VOTE_INVALID_ANSWERS: % allows one choice.', v_question.question_text using errcode = 'P0001';
    end if;

    if exists (
      select 1 from unnest(v_selected) as selected(id)
      where not exists (
        select 1 from public.meeting_choices c
        where c.id = selected.id and c.question_id = v_question.id
      )
    ) then
      raise exception 'VOTE_INVALID_ANSWERS: A selected choice does not belong to %.', v_question.question_text using errcode = 'P0001';
    end if;

    select exists (
      select 1 from public.meeting_choices c
      where c.id = any(v_selected) and c.is_abstain
    ) into v_has_abstain;

    if v_has_abstain and v_count > 1 then
      raise exception 'VOTE_INVALID_ANSWERS: Abstain cannot be combined with other choices for %.', v_question.question_text using errcode = 'P0001';
    end if;

    if v_question.question_type = 'multiple_choice'
      and v_question.max_choices is not null
      and v_count > v_question.max_choices then
      raise exception 'VOTE_INVALID_ANSWERS: % allows at most % choices.', v_question.question_text, v_question.max_choices using errcode = 'P0001';
    end if;

    return query select v_question.id, selected.id from unnest(v_selected) as selected(id);
  end loop;
end;
$$;

