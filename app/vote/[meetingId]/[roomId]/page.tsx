import {
  BallotChoiceInputs,
  selectedChoicesByQuestion,
} from "@/features/voting/components/ballot-choice-inputs";
import { notFound } from "next/navigation";
import { Vote } from "lucide-react";
import { choiceLabel } from "@/lib/i18n/choice";
import { RequiredMark } from "@/features/admin/components/field-label";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { submitBallot } from "@/features/voting/actions";
import { BallotForm } from "@/features/voting/components/ballot-form";
import {
  describeVoterRoom,
  describeVotingWindow,
  formatVoterDateTime,
} from "@/features/voting/display";
import { getVotingAssignmentData } from "@/features/voting/data";
import { VotingStatusBadge } from "@/features/voting/status-badge";
import { getVotingWindowStatus } from "@/features/voting/status";
import { getI18n } from "@/lib/i18n/server";

type VoteDetailPageProps = {
  params: Promise<{
    meetingId: string;
    roomId: string;
  }>;
};

function getVersionAnswers(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("answers" in payload)) {
    return [];
  }

  const answers = payload.answers;

  if (!Array.isArray(answers)) {
    return [];
  }

  return answers.filter(
    (answer): answer is { question_id: string; choice_id: string } =>
      Boolean(
        answer &&
          typeof answer === "object" &&
          "question_id" in answer &&
          "choice_id" in answer &&
          typeof answer.question_id === "string" &&
          typeof answer.choice_id === "string",
      ),
  );
}

export default async function VoteDetailPage({ params }: VoteDetailPageProps) {
  const { meetingId, roomId } = await params;
  const { eligible, questions, ballot } = await getVotingAssignmentData(
    meetingId,
    roomId,
  );

  if (!eligible) {
    notFound();
  }

  const { locale, t: dict } = await getI18n();
  const t = dict.vote;
  const meeting = eligible.meetings;
  const room = eligible.rooms;
  const answerByQuestion = selectedChoicesByQuestion(ballot?.ballot_answers);
  const votingStatus = getVotingWindowStatus(meeting);
  const choiceTextById = new Map(
    questions.flatMap((question) =>
      question.meeting_choices.map((choice) => [
        choice.id,
        choiceLabel(choice.choice_text, choice.is_abstain, locale),
      ]),
    ),
  );
  const questionTextById = new Map(
    questions.map((question) => [question.id, question.question_text]),
  );
  const ballotVersions = [...(ballot?.ballot_versions ?? [])].sort(
    (left, right) => right.version_number - left.version_number,
  );

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start gap-3">
          <Vote className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">
              {meeting?.title ?? t.title}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {describeVoterRoom(
                room?.room_number,
                eligible.voter_type,
                eligible.ownership_percent,
                locale,
              )}
            </p>
            {meeting?.ballot_secrecy === "secret" ? (
              <p className="mt-1 text-sm font-medium">
                {t.secretBallot}
              </p>
            ) : null}
          </div>
        </div>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              {meeting ? (
                <p className="text-sm font-medium">
                  {describeVotingWindow(meeting, votingStatus, locale)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-[var(--muted)] md:items-end">
              <VotingStatusBadge
                locale={locale}
                status={votingStatus}
                submittedVersion={
                  ballot?.status === "submitted" ? ballot.version_number : null
                }
              />
              {ballot?.status === "submitted" ? (
                <div>
                  {votingStatus.canSubmit
                    ? t.openForEdits
                    : t.status[votingStatus.label]}
                </div>
              ) : null}
              {ballot?.submitted_at ? (
                <div>{t.submittedAt(formatVoterDateTime(ballot.submitted_at, locale))}</div>
              ) : null}
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              {t.noQuestions}
            </p>
          ) : (
            <BallotForm action={submitBallot} className="mt-4 grid gap-5">
              <p className="text-xs text-[var(--muted)]">{t.requiredNote}</p>
              <input name="meeting_id" type="hidden" value={eligible.meeting_id} />
              <input name="room_id" type="hidden" value={eligible.room_id} />
              {questions.map((question) => (
                <fieldset
                  aria-describedby={`question-error-${question.id}`}
                  className="scroll-mt-28 rounded-md border border-[var(--border)] p-4"
                  data-required={question.required ? "true" : "false"}
                  key={question.id}
                >
                  {/* Floated legend sits inside the card instead of on its
                      border, so long questions wrap cleanly. */}
                  <legend className="float-left w-full">
                    {question.agenda_no || question.agenda_title ? (
                      <span className="block text-xs font-medium text-[var(--muted)]">
                        {[
                          question.agenda_no ? t.agenda(question.agenda_no) : null,
                          question.agenda_title,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-base font-semibold">
                      {question.question_text}
                      {question.required ? (
                        <>
                          {" "}
                          <RequiredMark />
                        </>
                      ) : null}
                    </span>
                  </legend>
                  <p
                    className="clear-both pt-2 text-sm font-medium text-red-700"
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
                    disabled={!votingStatus.canSubmit}
                    locale={locale}
                    question={question}
                    selectedChoiceIds={
                      answerByQuestion.get(question.id) ?? new Set<string>()
                    }
                  />
                </fieldset>
              ))}
              <p className="text-sm text-[var(--muted)]">
                {t.canChange}
              </p>
              <PendingSubmitButton
                className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!votingStatus.canSubmit}
                pendingLabel={t.submitting}
                type="submit"
              >
                {ballot ? t.update : t.submit}
              </PendingSubmitButton>
            </BallotForm>
          )}
        </section>

        {ballotVersions.length > 0 ? (
          <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold">{t.historyTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t.historyText}
            </p>
            <div className="mt-4 grid gap-3">
              {ballotVersions.map((version) => {
                const answers = getVersionAnswers(version.payload_json);

                return (
                  <article
                    className="rounded-md border border-[var(--border)] p-4"
                    key={version.id}
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <h3 className="font-semibold">
                        {t.version(version.version_number)}
                      </h3>
                      <div className="text-sm text-[var(--muted)]">
                        {formatVoterDateTime(version.created_at, locale)}
                      </div>
                    </div>
                    {answers.length > 0 ? (
                      <dl className="mt-3 grid gap-2 text-sm">
                        {answers.map((answer) => (
                          <div
                            className="grid gap-1 md:grid-cols-[1fr_1fr]"
                            key={`${version.id}:${answer.question_id}`}
                          >
                            <dt className="text-[var(--muted)]">
                              {questionTextById.get(answer.question_id) ??
                                t.question}
                            </dt>
                            <dd className="font-medium">
                              {choiceTextById.get(answer.choice_id) ?? t.choice}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        {t.noAnswers}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
