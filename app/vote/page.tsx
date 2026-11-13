import Link from "next/link";
import { Vote } from "lucide-react";
import { getVotingDashboardData } from "@/features/voting/data";
import { describeVoterRoom, describeVotingWindow } from "@/features/voting/display";
import { VotingStatusBadge } from "@/features/voting/status-badge";
import { getVotingWindowStatus } from "@/features/voting/status";
import { getI18n } from "@/lib/i18n/server";
import { requireVoteAccess } from "@/lib/auth/access";

export default async function VotePage() {
  const access = await requireVoteAccess();
  const { eligibleRows, ballotsByMeetingRoom } = await getVotingDashboardData();
  const { locale, t: dict } = await getI18n();
  const t = dict.vote;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-[var(--muted)]">
              {t.intro}
            </p>
          </div>
        </div>

        {access.delegatedRooms.length > 0 ? (
          <section
            className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            data-testid="delegated-rooms"
          >
            <h2 className="font-semibold">{t.delegatedTitle}</h2>
            <ul className="mt-2 grid gap-1 text-[var(--muted)]">
              {access.delegatedRooms.map((room) => (
                <li key={`${room.meeting_title}:${room.room_number}`}>
                  {t.delegated(room.room_number, room.proxy_name, room.meeting_title)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {eligibleRows.length === 0 ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <h2 className="font-semibold">{t.emptyTitle}</h2>
            <p className="mt-1 text-[var(--muted)]">
              {t.emptyText}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 font-medium"
              href="/summary"
            >
              {t.openSummary}
            </Link>
          </section>
        ) : (
          <div className="grid gap-4">
            {eligibleRows.map((eligible) => {
              const meeting = eligible.meetings;
              const room = eligible.rooms;
              const ballot = ballotsByMeetingRoom.get(
                `${eligible.meeting_id}:${eligible.room_id}`,
              );
              const votingStatus = getVotingWindowStatus(meeting);
              const href = `/vote/${eligible.meeting_id}/${eligible.room_id}`;

              return (
                <section
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
                  key={eligible.id}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {meeting?.title ?? t.meeting}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {describeVoterRoom(
                          room?.room_number,
                          eligible.voter_type,
                          eligible.ownership_percent,
                          locale,
                        )}
                      </p>
                      {meeting ? (
                        <p className="mt-1 text-sm font-medium">
                          {describeVotingWindow(meeting, votingStatus, locale)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <VotingStatusBadge
                        locale={locale}
                        status={votingStatus}
                        submittedVersion={
                          ballot?.status === "submitted"
                            ? ballot.version_number
                            : null
                        }
                      />
                      {ballot?.status === "submitted" ? (
                        <div className="text-sm text-[var(--muted)]">
                          {votingStatus.canSubmit
                            ? t.openForEdits
                            : t.status[votingStatus.label]}
                        </div>
                      ) : null}
                      <Link
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                        href={href}
                      >
                        {t.openBallot}
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
