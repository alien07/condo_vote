// Renders the choices of one ballot question (D017): radio buttons for single
// choice, checkboxes for multiple choice. Used by the online ballot and the
// admin manual ballot form. The voting core service validates the answers.

import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

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
  locale = "en",
  question,
  selectedChoiceIds,
}: {
  /** Owner's language on the online ballot; the admin form stays English. */
  locale?: Locale;
  choices: BallotChoice[];
  disabled?: boolean;
  question: BallotQuestion;
  selectedChoiceIds: ReadonlySet<string>;
}) {
  const t = getDictionary(locale).vote;
  const multiple = question.question_type === "multiple_choice";
  const sortedChoices = [...choices].sort(
    (left, right) => left.display_order - right.display_order,
  );

  return (
    <div className="mt-3 grid gap-2">
      {multiple ? (
        <p className="text-xs text-[var(--muted)]">
          {question.max_choices
            ? t.chooseUpTo(question.max_choices)
            : t.chooseOneOrMore}{" "}
          {t.abstainAlone}
        </p>
      ) : null}
      {sortedChoices.map((choice) => (
        <label
          className={[
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm",
            "has-[:checked]:border-[var(--primary)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)]",
            "has-[:disabled]:cursor-not-allowed",
            // Abstain is a real choice, so it reads like one; a gap sets it apart.
            choice.is_abstain ? "mt-2" : "",
          ].join(" ")}
          key={choice.id}
        >
          <input
            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
            defaultChecked={selectedChoiceIds.has(choice.id)}
            disabled={disabled}
            name={`choice:${question.id}`}
            required={!multiple && question.required}
            type={multiple ? "checkbox" : "radio"}
            value={choice.id}
          />
          <span>{choice.choice_text}</span>
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
