import Link from "next/link";
import { ConfirmButton } from "@/features/ui/confirm-button";
import { grantCoOwnerVote } from "@/features/voting/co-owner-actions";
import type { getVotingDashboardData } from "@/features/voting/data";
import { describeVoterRoom, describeVotingWindow } from "@/features/voting/display";
import { VotingStatusBadge } from "@/features/voting/status-badge";
import { getVotingWindowStatus } from "@/features/voting/status";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { localized } from "@/lib/i18n/content";

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
  // The owner of record may let a co-owner vote, before the room has a ballot
  // and while voting has not ended (item 15).
  const canLetCoOwnerVote =
    row.voter_type === "owner" && !ballot && votingStatus.label !== "Closed" && votingStatus.label !== "Unavailable";

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
      data-room={row.rooms?.room_number}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {meeting ? localized(locale, meeting.title, meeting.title_en) : t.meeting}
          </h3>
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
      {canLetCoOwnerVote ? (
        <details className="mt-3 text-sm" data-co-owner>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-[var(--primary)]">
            {t.coOwnerTitle}
          </summary>
          <form action={grantCoOwnerVote} className="mt-2 grid gap-2 sm:max-w-md">
            <p className="text-[var(--muted)]">{t.coOwnerText}</p>
            <input name="meeting_id" type="hidden" value={row.meeting_id} />
            <input name="room_id" type="hidden" value={row.room_id} />
            <label className="grid gap-1 font-medium">
              {t.coOwnerEmail}
              <input
                autoComplete="off"
                className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-normal"
                name="email"
                required
                type="email"
              />
            </label>
            <ConfirmButton
              cancelLabel={t.cancel}
              className="min-h-11 w-fit rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-medium"
              confirmLabel={t.confirm}
              confirmMessage={t.confirmCoOwner(row.rooms?.room_number ?? "-", meeting?.title ?? t.meeting)}
              confirmTitle={t.confirmTitle}
              tone="primary"
            >
              {t.coOwnerSend}
            </ConfirmButton>
          </form>
        </details>
      ) : null}
    </section>
  );
}
