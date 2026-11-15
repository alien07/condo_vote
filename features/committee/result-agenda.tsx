import { ChoiceResultsTable, type ChoiceResult } from "@/features/results/choice-results-table";
import { QuestionOutcomeLine, type QuestionOutcomePayload } from "@/features/results/question-outcome";
import { outcomeText } from "@/features/results/thai-labels";
import { localized } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/locales";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

export type AgendaQuestion = QuestionOutcomePayload & {
  pass_rule?: { basis?: string } | null;
  agenda_no?: string | null;
  agenda_title?: string | null;
  agenda_title_en?: string | null;
  text?: string;
  text_en?: string | null;
  choices?: ChoiceResult[];
};

/** Choices in the reader's language (snapshots since 0032 carry text_en). */
function localizedQuestion(locale: Locale, source: AgendaQuestion): AgendaQuestion {
  return {
    ...source,
    choices: source.choices?.map((choice) => ({
      ...choice,
      text: localized(locale, choice.text, (choice as { text_en?: string | null }).text_en) ?? undefined,
    })),
  };
}

function agendaName(locale: Locale, question: AgendaQuestion, index: number, t: StaffDictionary["committee"]) {
  const number = question.agenda_no ? fill(t.agenda, { no: question.agenda_no }) : fill(t.item, { no: index + 1 });
  const name =
    localized(locale, question.agenda_title, question.agenda_title_en) ??
    localized(locale, question.text, question.text_en) ??
    "-";

  return `${number} · ${name}`;
}

/**
 * The agenda results of one result card (UI review 2026-11-15): one short
 * line per agenda item is always shown; the pass rules and the tables open
 * on request, so four pending results no longer make the page nine screens
 * long and keyboard users do not tab through every "i" first.
 */
export function ResultAgenda({
  locale,
  questions,
  snapshotId,
  t,
}: {
  locale: Locale;
  questions: AgendaQuestion[] | undefined;
  snapshotId: string;
  t: StaffDictionary["committee"];
}) {
  if (!questions?.length) {
    return <p className="text-sm text-[var(--muted)]">{t.noItems}</p>;
  }

  const items = questions.map((source) => localizedQuestion(locale, source));

  return (
    <div className="grid min-w-0 gap-2 text-sm [&>*]:min-w-0" data-agenda>
      <ul className="grid gap-1" data-agenda-summary>
        {items.map((question, index) => {
          const passed = (question.choices ?? [])
            .filter((choice) => choice.id && question.passed_choice_ids?.includes(choice.id))
            .map((choice) => choice.text ?? "-");

          return (
            <li key={`${snapshotId}-line-${index}`}>
              <span className="font-medium">{agendaName(locale, question, index, t)}</span>
              {question.outcome ? (
                <span className="text-[var(--muted)]"> — {outcomeText(locale, question.outcome, passed)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <details className="group" data-agenda-tables>
        <summary className="tap-target inline-flex cursor-pointer items-center font-medium text-[var(--primary)] underline">
          <span className="group-open:hidden">{fill(t.showAgendaTables, { count: items.length })}</span>
          <span className="hidden group-open:inline">{t.hideAgendaTables}</span>
        </summary>
        <div className="mt-3 grid gap-4 [&>*]:min-w-0">
          {items.map((question, index) => (
            <div className="border-t border-[var(--border)] pt-3" key={`${snapshotId}-table-${index}`}>
              <div className="font-medium">{agendaName(locale, question, index, t)}</div>
              <QuestionOutcomeLine locale={locale} question={question} />
              <ChoiceResultsTable choices={question.choices} locale={locale} ruleBasis={question.pass_rule?.basis} />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
