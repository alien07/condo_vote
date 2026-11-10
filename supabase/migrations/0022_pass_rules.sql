-- Configurable pass rules per question (D013).
-- required_threshold now names a preset, or 'custom' when admin sets the rule
-- directly. pass_basis, pass_operator, and pass_percent hold the rule that the
-- result calculation uses (features/results/pass-rules.ts).

alter table public.meeting_questions
  add column pass_basis text not null default 'voting_ownership',
  add column pass_operator text not null default 'gt',
  add column pass_percent numeric(9, 6) not null default 50,
  add constraint meeting_questions_pass_basis_check
    check (pass_basis in ('voting_ownership', 'total_ownership', 'none')),
  add constraint meeting_questions_pass_operator_check
    check (pass_operator in ('gt', 'gte')),
  add constraint meeting_questions_pass_percent_check
    check (pass_percent >= 0 and pass_percent <= 100);

alter table public.meeting_questions
  drop constraint meeting_questions_required_threshold_check,
  add constraint meeting_questions_required_threshold_check check (
    required_threshold in (
      'majority_submitted',
      'one_third_total',
      'half_total',
      'three_fourths_total',
      'informational',
      'custom'
    )
  );

-- Existing questions keep the rule their preset described.
update public.meeting_questions set
  pass_basis = case required_threshold
    when 'majority_submitted' then 'voting_ownership'
    when 'informational' then 'none'
    else 'total_ownership'
  end,
  pass_operator = case required_threshold
    when 'one_third_total' then 'gte'
    when 'three_fourths_total' then 'gte'
    when 'informational' then 'gte'
    else 'gt'
  end,
  pass_percent = case required_threshold
    when 'one_third_total' then 33.333333
    when 'three_fourths_total' then 75
    when 'informational' then 0
    else 50
  end;
