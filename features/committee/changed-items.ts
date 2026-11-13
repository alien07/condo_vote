// Which agenda items' numbers changed between two result snapshots (demo
// feedback item 12: a result generated again after a correction request).

type Choice = { id?: string; text?: string; vote_count?: number; ownership?: number };
type Question = { agenda_no?: string | null; text?: string; choices?: Choice[]; outcome?: string | null };
type Payload = { questions?: Question[] } | null | undefined;

function numbers(question: Question | undefined) {
  return JSON.stringify(
    (question?.choices ?? []).map((choice) => [
      choice.id ?? choice.text ?? "",
      Number(choice.vote_count ?? 0),
      Number(choice.ownership ?? 0),
    ]),
  ) + `|${question?.outcome ?? ""}`;
}

/** Labels ("1", "2", or the question text) of items whose counts or outcome
 * differ; an empty list means the numbers are the same. */
export function changedAgendaItems(previous: Payload, current: Payload): string[] {
  const before = previous?.questions ?? [];
  const after = current?.questions ?? [];
  const length = Math.max(before.length, after.length);
  const changed: string[] = [];

  for (let index = 0; index < length; index += 1) {
    if (numbers(before[index]) !== numbers(after[index])) {
      const question = after[index] ?? before[index];
      changed.push(question?.agenda_no || question?.text || String(index + 1));
    }
  }

  return changed;
}
