import Link from "next/link";
import type { getVotingDashboardData } from "@/features/voting/data";
import { describeVoterRoom, describeVotingWindow } from "@/features/voting/display";
import { VotingStatusBadge } from "@/features/voting/status-badge";
import { getVotingWindowStatus } from "@/features/voting/status";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export type VoteRow = Awaited<ReturnType<typeof getVotingDashboardData>>["eligibleRows"][number];

type Ballot = { status: string; version_number: number } | undefined;

/** One room in one meeting on the Vote list. */
export function VoteRowCard({
  row,
  ballot,
  locale,
  t,
}: {
  row: VoteRow;
  ballot: Ballot;
  locale: Locale;
  t: Dictionary["vote"];
}) {
  const meeting = row.meetings;
  const votingStatus = getVotingWindowStatus(meeting);

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
      data-room={row.rooms?.room_number}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{meeting?.title ?? t.meeting}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {describeVoterRoom(
              row.rooms?.room_number,
              row.voter_type,
              row.ownership_percent,
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
            submittedVersion={ballot?.status === "submitted" ? ballot.version_number : null}
          />
          {ballot?.status === "submitted" ? (
            <div className="text-sm text-[var(--muted)]">
              {votingStatus.canSubmit ? t.openForEdits : t.status[votingStatus.label]}
            </div>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            href={`/vote/${row.meeting_id}/${row.room_id}`}
          >
            {t.openBallot}
          </Link>
        </div>
      </div>
    </section>
  );
}
