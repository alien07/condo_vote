import Link from "next/link";
import { notFound } from "next/navigation";
import { Vote } from "lucide-react";
import { submitBallot } from "@/features/voting/actions";
import { getVotingAssignmentData } from "@/features/voting/data";

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

function isVotingOpen(meeting: {
  status: string;
  starts_at: string;
  ends_at: string;
}) {
  const now = new Date();

  return (
    meeting.status === "published" &&
    now >= new Date(meeting.starts_at) &&
    now <= new Date(meeting.ends_at)
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
  const votingOpen = meeting ? isVotingOpen(meeting) : false;

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
                  : votingOpen
                    ? "Open"
                    : "Closed"}
              </div>
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
                            disabled={!votingOpen}
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
                disabled={!votingOpen}
                type="submit"
              >
                {ballot ? "Update ballot" : "Submit ballot"}
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
