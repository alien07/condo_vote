import Link from "next/link";
import { Vote } from "lucide-react";
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
  const { eligibleRows, ballotsByMeetingRoom } = await getVotingDashboardData();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">Vote</h1>
            <p className="text-sm text-[var(--muted)]">
              Select an eligible meeting and room to submit or edit a ballot.
            </p>
          </div>
        </div>

        {eligibleRows.length === 0 ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No eligible voting assignments are available for your profile.
          </section>
        ) : (
          <div className="grid gap-4">
            {eligibleRows.map((eligible) => {
              const meeting = eligible.meetings;
              const room = eligible.rooms;
              const ballot = ballotsByMeetingRoom.get(
                `${eligible.meeting_id}:${eligible.room_id}`,
              );
              const votingOpen = meeting ? isVotingOpen(meeting) : false;
              const href = `/vote/${eligible.meeting_id}/${eligible.room_id}`;

              return (
                <section
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
                  key={eligible.id}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="text-sm text-[var(--muted)]">
                        {ballot?.status === "submitted"
                          ? `Submitted v${ballot.version_number}`
                          : votingOpen
                            ? "Open"
                            : "Closed"}
                      </div>
                      <Link
                        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                        href={href}
                      >
                        Open ballot
                      </Link>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
