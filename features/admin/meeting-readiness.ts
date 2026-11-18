// Is a draft meeting ready to publish? (2026-11-18 review.) After
// publishing, the agenda is locked (0039), so a meeting needs at least one
// agenda item, and every item needs a choice other than the default
// Abstain. Used by the agenda page (steps, publish button) and by
// publishMeeting.

export type ReadinessQuestion = {
  agenda_no?: string | null;
  question_text: string;
  meeting_choices?: { is_abstain?: boolean | null }[] | null;
};

export type MeetingReadiness = {
  ready: boolean;
  noAgenda: boolean;
  /** Agenda items that have no choice except Abstain, as "no. text". */
  withoutChoices: string[];
};

export const PUBLISH_NO_AGENDA = "Add at least one agenda item before publishing.";
export const PUBLISH_NO_CHOICES =
  "Every agenda item needs a choice other than Abstain before publishing.";

export function meetingReadiness(questions: ReadinessQuestion[]): MeetingReadiness {
  const withoutChoices = questions
    .filter((question) => !(question.meeting_choices ?? []).some((choice) => !choice.is_abstain))
    .map((question) =>
      [question.agenda_no?.trim(), question.question_text].filter(Boolean).join(" "),
    );
  const noAgenda = questions.length === 0;

  return { ready: !noAgenda && withoutChoices.length === 0, noAgenda, withoutChoices };
}

/** The English message publishMeeting returns, or null when ready. */
export function readinessMessage(readiness: MeetingReadiness) {
  if (readiness.noAgenda) {
    return PUBLISH_NO_AGENDA;
  }

  return readiness.withoutChoices.length ? PUBLISH_NO_CHOICES : null;
}
