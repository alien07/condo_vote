import { Vote } from "lucide-react";
import { submitBallot } from "@/features/voting/actions";
import { getVotingDashboardData } from "@/features/voting/data";

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

export default async function VotePage() {
  const {
    eligibleRows,
    questionsByMeeting,
    ballotsByMeetingRoom,
  } = await getVotingDashboardData();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">Vote</h1>
            <p className="text-sm text-[var(--muted)]">
              Submit or edit ballots for rooms where you are eligible.
            </p>
          </div>
        </div>

        {eligibleRows.length === 0 ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No eligible voting assignments are available for your profile.
          </section>
        ) : (
          <div className="grid gap-5">
            {eligibleRows.map((eligible) => {
              const meeting = eligible.meetings;
              const room = eligible.rooms;
              const questions = questionsByMeeting.get(eligible.meeting_id) ?? [];
              const ballot = ballotsByMeetingRoom.get(
                `${eligible.meeting_id}:${eligible.room_id}`,
              );
              const answerByQuestion = new Map(
                ballot?.ballot_answers.map((answer) => [
                  answer.question_id,
                  answer.choice_id,
                ]) ?? [],
              );
              const votingOpen = meeting ? isVotingOpen(meeting) : false;

              return (
                <section
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
                  key={eligible.id}
                >
                  <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {meeting?.title ?? "Meeting"}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Room {room?.room_number ?? "-"} / {eligible.voter_type} /{" "}
                        ownership {eligible.ownership_percent}%
                      </p>
                      {meeting ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">
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
                        <div className="mt-1">
                          {formatDateTime(ballot.submitted_at)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {questions.length === 0 ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      No voting questions are configured for this meeting.
                    </p>
                  ) : (
                    <form action={submitBallot} className="mt-4 grid gap-5">
                      <input
                        name="meeting_id"
                        type="hidden"
                        value={eligible.meeting_id}
                      />
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
                                (left, right) =>
                                  left.display_order - right.display_order,
                              )
                              .map((choice) => (
                                <label
                                  className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                                  key={choice.id}
                                >
                                  <input
                                    defaultChecked={
                                      answerByQuestion.get(question.id) ===
                                      choice.id
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
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
