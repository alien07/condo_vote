// Renders the choices of one ballot question (D017): radio buttons for single
// choice, checkboxes for multiple choice. Used by the online ballot and the
// admin manual ballot form. The voting core service validates the answers.

type BallotChoice = {
  id: string;
  choice_text: string;
  display_order: number;
  is_abstain?: boolean | null;
};

type BallotQuestion = {
  id: string;
  question_type?: string | null;
  required: boolean;
  max_choices?: number | null;
};

export function BallotChoiceInputs({
  choices,
  disabled = false,
  question,
  selectedChoiceIds,
}: {
  choices: BallotChoice[];
  disabled?: boolean;
  question: BallotQuestion;
  selectedChoiceIds: ReadonlySet<string>;
}) {
  const multiple = question.question_type === "multiple_choice";
  const sortedChoices = [...choices].sort(
    (left, right) => left.display_order - right.display_order,
  );

  return (
    <div className="mt-3 grid gap-2">
      {multiple ? (
        <p className="text-xs text-[var(--muted)]">
          {question.max_choices
            ? `Choose up to ${question.max_choices}.`
            : "Choose one or more."}{" "}
          Abstain cannot be combined with other choices.
        </p>
      ) : null}
      {sortedChoices.map((choice) => (
        <label
          className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          key={choice.id}
        >
          <input
            defaultChecked={selectedChoiceIds.has(choice.id)}
            disabled={disabled}
            name={`choice:${question.id}`}
            required={!multiple && question.required}
            type={multiple ? "checkbox" : "radio"}
            value={choice.id}
          />
          <span className={choice.is_abstain ? "text-[var(--muted)]" : undefined}>
            {choice.choice_text}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Groups saved answers by question for prefilling the form. */
export function selectedChoicesByQuestion(
  answers: ReadonlyArray<{ question_id: string; choice_id: string }> | undefined,
) {
  const byQuestion = new Map<string, Set<string>>();

  for (const answer of answers ?? []) {
    const selected = byQuestion.get(answer.question_id) ?? new Set<string>();
    selected.add(answer.choice_id);
    byQuestion.set(answer.question_id, selected);
  }

  return byQuestion;
}
