-- Deleting an agenda item deletes its choices (2026-11-18).
--
-- Before: meeting_choices.question_id had no ON DELETE rule, so deleting a
-- draft agenda item that had choices failed with 23503 and the admin page
-- crashed. Choices belong to their agenda item, so they go with it.
--
-- Votes are still protected: ballot_answers and the manual vote tables
-- reference the choice without a cascade, so an agenda item that has votes
-- cannot be deleted. The agenda lock (0039) already blocks deleting items of
-- a published meeting in the app.

alter table public.meeting_choices
  drop constraint meeting_choices_question_id_fkey,
  add constraint meeting_choices_question_id_fkey
    foreign key (question_id) references public.meeting_questions(id) on delete cascade;
