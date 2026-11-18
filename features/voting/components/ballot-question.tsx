// One question of a ballot as the owner sees it (2026-11-18): used by the
// online ballot and by the admin's ballot preview, so the preview matches.

import { RequiredMark } from "@/features/admin/components/field-label";
import { CountedText } from "@/features/committee/counted-text";
import { BallotChoiceInputs } from "@/features/voting/components/ballot-choice-inputs";
import { localized } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export type BallotQuestionData = {
  id: string;
  agenda_no?: string | null;
  agenda_title?: string | null;
  agenda_title_en?: string | null;
  question_text: string;
  question_text_en?: string | null;
  question_type?: string | null;
  max_choices?: number | null;
  required: boolean;
  allow_comment?: boolean | null;
  meeting_choices: {
    id: string;
    choice_text: string;
    choice_text_en?: string | null;
    display_order: number;
    is_abstain?: boolean | null;
  }[];
};

export function BallotQuestion({
  comment = "",
  disabled = false,
  locale,
  question,
  selectedChoiceIds = new Set<string>(),
}: {
  comment?: string;
  disabled?: boolean;
  locale: Locale;
  question: BallotQuestionData;
  selectedChoiceIds?: ReadonlySet<string>;
}) {
  const t = getDictionary(locale).vote;

  return (
    <fieldset
      aria-describedby={`question-error-${question.id}`}
      className="scroll-mt-28 rounded-md border border-[var(--border)] p-4 aria-[invalid=true]:border-2 aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:bg-[var(--danger-surface)]"
      data-required={question.required ? "true" : "false"}
    >
      {/* Floated legend sits inside the card instead of on its border, so
          long questions wrap cleanly. */}
      <legend className="float-left w-full">
        {question.agenda_no || question.agenda_title ? (
          <span className="block text-xs font-medium text-[var(--muted)]">
            {[
              question.agenda_no ? t.agenda(question.agenda_no) : null,
              localized(locale, question.agenda_title, question.agenda_title_en),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
        <span className="mt-1 block text-base font-semibold">
          {localized(locale, question.question_text, question.question_text_en)}
          {question.required ? (
            <>
              {" "}
              <RequiredMark />
            </>
          ) : null}
        </span>
      </legend>
      <p
        className="clear-both pt-2 text-sm font-medium text-[var(--danger)]"
        data-question-error
        hidden
        id={`question-error-${question.id}`}
        role="alert"
      >
        {t.chooseAnswer}
      </p>
      <div className="clear-both" />
      <BallotChoiceInputs
        choices={question.meeting_choices}
        disabled={disabled}
        locale={locale}
        question={question}
        selectedChoiceIds={selectedChoiceIds}
      />
      {question.allow_comment ? (
        // Optional comment with any answer (0040).
        <label className="mt-3 grid gap-1 text-sm font-medium">
          {t.commentLabel}
          <span className="text-xs font-normal text-[var(--muted)]">{t.commentHelp}</span>
          <CountedText
            className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
            defaultValue={comment}
            disabled={disabled}
            maxLength={500}
            multiline
            name={`comment:${question.id}`}
            rows={3}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
