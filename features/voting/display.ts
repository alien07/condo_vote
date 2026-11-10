import type { VotingWindowStatus } from "@/features/voting/status";
import { APP_TIME_ZONE } from "@/lib/datetime";

// Plain-language text for the voter screens. Times show in Asia/Bangkok (D014).

const dateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export function formatVoterDateTime(value: string) {
  return dateTime.format(new Date(value));
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
) {
  if (!meeting) {
    return null;
  }

  if (status.label === "Open") {
    return status.phase === "advance" && meeting.advance_ends_at
      ? `Advance voting closes ${formatVoterDateTime(meeting.advance_ends_at)}. Meeting-day voting opens ${formatVoterDateTime(meeting.starts_at)}.`
      : `Voting closes ${formatVoterDateTime(meeting.ends_at)}`;
  }

  if (status.label === "Not open yet") {
    return status.nextPhase === "advance" && meeting.advance_starts_at
      ? `Advance voting opens ${formatVoterDateTime(meeting.advance_starts_at)}`
      : `Meeting-day voting opens ${formatVoterDateTime(meeting.starts_at)}`;
  }

  if (status.label === "Closed") {
    return `Voting closed ${formatVoterDateTime(meeting.closed_at ?? meeting.ends_at)}`;
  }

  return null;
}

const voterTypeLabels: Record<string, string> = {
  owner: "Owner",
  proxy: "Proxy",
};

/** "Room A-1204 · Owner · 1.25% ownership" */
export function describeVoterRoom(
  roomNumber: string | null | undefined,
  voterType: string,
  ownershipPercent: number | string,
) {
  return [
    `Room ${roomNumber ?? "-"}`,
    voterTypeLabels[voterType] ?? voterType,
    `${ownershipPercent}% ownership`,
  ].join(" · ");
}
