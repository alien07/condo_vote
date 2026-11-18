// Paper ballot answers for the list on /admin/voting (2026-11-19).

import { choiceLabel } from "@/lib/i18n/choice";
import type { Locale } from "@/lib/i18n/locales";

export type BallotAnswer = { questionId: string; question: string; choices: string };

export type RawAnswer = {
  question_id: string;
  meeting_questions: { question_text: string; agenda_no: string | null; display_order: number | null } | null;
  meeting_choices: { choice_text: string; display_order: number | null; is_abstain?: boolean | null } | null;
};

/** One line per agenda item, in agenda order, its choices joined (a
 * multiple-choice item no longer repeats once per choice). */
export function ballotAnswers(answers: RawAnswer[], locale: Locale): BallotAnswer[] {
  const byQuestion = new Map<string, { order: number; question: string; choices: { order: number; text: string }[] }>();

  for (const answer of answers) {
    const question = answer.meeting_questions;
    const entry = byQuestion.get(answer.question_id) ?? {
      order: question?.display_order ?? 0,
      question: question
        ? `${question.agenda_no ? `${question.agenda_no}. ` : ""}${question.question_text}`
        : "-",
      choices: [],
    };

    entry.choices.push({
      order: answer.meeting_choices?.display_order ?? 0,
      text: answer.meeting_choices
        ? choiceLabel(answer.meeting_choices.choice_text, answer.meeting_choices.is_abstain, locale)
        : "-",
    });
    byQuestion.set(answer.question_id, entry);
  }

  return [...byQuestion.entries()]
    .sort(([, left], [, right]) => left.order - right.order)
    .map(([questionId, entry]) => ({
      questionId,
      question: entry.question,
      choices: entry.choices
        .sort((left, right) => left.order - right.order)
        .map((choice) => choice.text)
        .join(", "),
    }));
}
