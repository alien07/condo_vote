-- Length limits for text typed on the Committee page (review 2026-11-14):
-- reasons, notes and answers up to 500 characters, legal or by-law
-- references up to 200. The page shows a counter ("120/500").
--
-- NOT VALID: rows written before this migration are not checked, so a long
-- text already saved stays readable; every new or changed row is checked.

alter table public.meeting_close_requests
  add constraint meeting_close_requests_reason_length
  check (char_length(reason) <= 500) not valid;

alter table public.meeting_close_request_answers
  add constraint meeting_close_request_answers_reason_length
  check (reason is null or char_length(reason) <= 500) not valid;

alter table public.result_correction_requests
  add constraint result_correction_requests_text_length
  check (
    char_length(reason) <= 500
    and (legal_reference is null or char_length(legal_reference) <= 200)
    and (answer is null or char_length(answer) <= 500)
    and (level_change_reason is null or char_length(level_change_reason) <= 500)
  ) not valid;

alter table public.committee_approvals
  add constraint committee_approvals_notes_length
  check (notes is null or char_length(notes) <= 500) not valid;
