// Shows a question's pass rule and outcome (D013) from a result snapshot.
// Snapshots made before pass rules existed have no pass_rule and show nothing.

export type QuestionOutcomePayload = {
  pass_rule?: { label?: string } | null;
  outcome?: "decided" | "not_decided" | "informational" | null;
  passed_choice_ids?: string[] | null;
  choices?: { id?: string; text?: string }[];
};

export function QuestionOutcomeLine({
  question,
}: {
  question: QuestionOutcomePayload;
}) {
  if (!question.pass_rule?.label || !question.outcome) {
    return null;
  }

  const passedTexts = (question.choices ?? [])
    .filter((choice) => choice.id && question.passed_choice_ids?.includes(choice.id))
    .map((choice) => choice.text ?? "-");
  const outcome =
    question.outcome === "informational"
      ? "Informational"
      : question.outcome === "decided"
        ? `Decided: ${passedTexts.join(", ")}`
        : "Not decided: no choice met the pass rule";

  return (
    <p className="mt-1 text-sm">
      <span className="text-[var(--muted)]">Pass rule: {question.pass_rule.label}. </span>
      <span className="font-medium" data-outcome={question.outcome}>
        {outcome}
      </span>
    </p>
  );
}
