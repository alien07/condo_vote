import type { VotingWindowStatus } from "@/features/voting/status";

// Plain-language text for the voter screens. Times show in Asia/Bangkok (D014).

const dateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

export function formatVoterDateTime(value: string) {
  return dateTime.format(new Date(value));
}

/** "Voting closes Fri 13 Nov 2026, 13:43" and similar, by window status. */
export function describeVotingWindow(
  meeting: { starts_at: string; ends_at: string; closed_at?: string | null } | null,
  status: VotingWindowStatus,
) {
  if (!meeting) {
    return null;
  }

  switch (status.label) {
    case "Not open yet":
      return `Voting opens ${formatVoterDateTime(meeting.starts_at)}`;
    case "Open":
      return `Voting closes ${formatVoterDateTime(meeting.ends_at)}`;
    case "Closed":
      return `Voting closed ${formatVoterDateTime(meeting.closed_at ?? meeting.ends_at)}`;
    default:
      return null;
  }
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
