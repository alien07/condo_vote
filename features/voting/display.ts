import type { VotingWindowStatus } from "@/features/voting/status";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDateTimeIn } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";

// Plain-language text for the voter screens, in the owner's language (D020).
// Times show in Asia/Bangkok (D014).

export function formatVoterDateTime(value: string, locale: Locale) {
  return formatDateTimeIn(locale, value);
}

/** "Voting closes Fri 13 Nov 2026, 13:43" and similar, by window status. */
export function describeVotingWindow(
  meeting: {
    starts_at: string;
    ends_at: string;
    closed_at?: string | null;
    advance_starts_at?: string | null;
    advance_ends_at?: string | null;
  } | null,
  status: VotingWindowStatus,
  locale: Locale,
) {
  if (!meeting) {
    return null;
  }

  const t = getDictionary(locale).vote.window;
  const time = (value: string) => formatDateTimeIn(locale, value);

  if (status.label === "Open") {
    return status.phase === "advance" && meeting.advance_ends_at
      ? t.advanceOpen(time(meeting.advance_ends_at), time(meeting.starts_at))
      : t.closes(time(meeting.ends_at));
  }

  if (status.label === "Not open yet") {
    return status.nextPhase === "advance" && meeting.advance_starts_at
      ? t.advanceOpens(time(meeting.advance_starts_at))
      : t.meetingOpens(time(meeting.starts_at));
  }

  if (status.label === "Closed") {
    return t.closed(time(meeting.closed_at ?? meeting.ends_at));
  }

  return null;
}

/** "Room A-1204 · Owner · 1.25% ownership" */
export function describeVoterRoom(
  roomNumber: string | null | undefined,
  voterType: string,
  ownershipPercent: number | string,
  locale: Locale,
) {
  const t = getDictionary(locale).vote;
  const voterTypeLabels: Record<string, string> = { owner: t.owner, proxy: t.proxy };

  return [
    t.room(roomNumber ?? "-"),
    voterTypeLabels[voterType] ?? voterType,
    t.ownership(String(ownershipPercent)),
  ].join(" · ");
}
