import Link from "next/link";
import { notFound } from "next/navigation";
import { Vote } from "lucide-react";
import { submitBallot } from "@/features/voting/actions";
import { getVotingAssignmentData } from "@/features/voting/data";
import { getVotingWindowStatus } from "@/features/voting/status";

type VoteDetailPageProps = {
  params: Promise<{
    meetingId: string;
    roomId: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

  const meeting = eligible.meetings;
  const room = eligible.rooms;
  const answerByQuestion = new Map(
    ballot?.ballot_answers.map((answer) => [
      answer.question_id,
      answer.choice_id,
    ]) ?? [],
  );
  const votingStatus = getVotingWindowStatus(meeting);
  const choiceTextById = new Map(
    questions.flatMap((question) =>
      question.meeting_choices.map((choice) => [choice.id, choice.choice_text]),
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
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <Link className="text-sm text-[var(--muted)]" href="/vote">
              Back to voting assignments
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              {meeting?.title ?? "Vote"}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Room {room?.room_number ?? "-"} / {eligible.voter_type} / ownership{" "}
              {eligible.ownership_percent}%
            </p>
          </div>
        </div>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              {meeting ? (
                <p className="text-sm text-[var(--muted)]">
                  {formatDateTime(meeting.starts_at)} -{" "}
                  {formatDateTime(meeting.ends_at)}
                </p>
              ) : null}
            </div>
            <div className="text-sm text-[var(--muted)]">
              <div>
                {ballot?.status === "submitted"
                  ? `Submitted v${ballot.version_number}`
                  : votingStatus.label}
              </div>
              {ballot?.status === "submitted" ? (
                <div className="mt-1">
                  {votingStatus.canSubmit ? "Open for edits" : votingStatus.label}
                </div>
              ) : null}
              {ballot?.submitted_at ? (
                <div className="mt-1">{formatDateTime(ballot.submitted_at)}</div>
              ) : null}
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No voting questions are configured for this meeting.
            </p>
          ) : (
            <form action={submitBallot} className="mt-4 grid gap-5">
              <input name="meeting_id" type="hidden" value={eligible.meeting_id} />
              <input name="room_id" type="hidden" value={eligible.room_id} />
              {questions.map((question) => (
                <fieldset
                  className="rounded-md border border-[var(--border)] p-4"
                  key={question.id}
                >
                  <legend className="px-1 text-sm font-semibold">
                    {question.agenda_no ? `${question.agenda_no}. ` : ""}
                    {question.question_text}
                  </legend>
                  {question.agenda_title ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {question.agenda_title}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {question.meeting_choices
                      .sort(
                        (left, right) => left.display_order - right.display_order,
                      )
                      .map((choice) => (
                        <label
                          className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          key={choice.id}
                        >
                          <input
                            defaultChecked={
                              answerByQuestion.get(question.id) === choice.id
                            }
                            disabled={!votingStatus.canSubmit}
                            name={`choice:${question.id}`}
                            required={question.required}
                            type="radio"
                            value={choice.id}
                          />
                          {choice.choice_text}
                        </label>
                      ))}
                  </div>
                </fieldset>
              ))}
              <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
                <h2 className="text-sm font-semibold">Review</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Confirm your selected choices before submitting. The latest
                  submitted version is the effective ballot while voting remains
                  open.
                </p>
              </section>
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!votingStatus.canSubmit}
                type="submit"
              >
                {ballot ? "Update ballot" : "Submit ballot"}
              </button>
            </form>
          )}
        </section>

        {ballotVersions.length > 0 ? (
          <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold">Version history</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Each submit or edit creates an immutable ballot version for audit.
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
                        Version v{version.version_number}
                      </h3>
                      <div className="text-sm text-[var(--muted)]">
                        {formatDateTime(version.created_at)}
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
                                "Question"}
                            </dt>
                            <dd className="font-medium">
                              {choiceTextById.get(answer.choice_id) ?? "Choice"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        No answers were captured for this version.
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
