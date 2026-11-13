// Vote list order (demo feedback item 7): "Open now" closing soonest first,
// "Coming up" opening soonest first, "Closed" most recent first; rooms by
// room number within a meeting. Before, rows came in the order the voting
// right was recorded, so an open meeting could sit under a closed one.

import { getVotingWindowStatus, type VotingWindowStatus } from "@/features/voting/status";

export type GroupKey = "open" | "upcoming" | "closed";

type MeetingLike = {
  status: string;
  starts_at: string;
  ends_at: string;
  closed_at?: string | null;
  advance_starts_at?: string | null;
  advance_ends_at?: string | null;
};

export type VoteRowLike = {
  meeting_id: string;
  room_id: string;
  meetings: MeetingLike | null;
  rooms: { room_number: string } | null;
};

export type VoteGroup<Row extends VoteRowLike> = {
  key: GroupKey;
  /** Rows of one meeting stay together, in room-number order. */
  meetings: { meetingId: string; rows: Row[] }[];
};

function groupOf(status: VotingWindowStatus): GroupKey {
  if (status.label === "Open") {
    return "open";
  }

  if (status.label === "Not open yet") {
    return "upcoming";
  }

  return "closed";
}

function time(value: string | null | undefined) {
  return value ? Date.parse(value) : Number.NaN;
}

/** The time a group sorts by: when it closes, when it opens, or when it closed. */
function sortTime(key: GroupKey, meeting: MeetingLike, status: VotingWindowStatus) {
  if (key === "open") {
    return status.phase === "advance" ? time(meeting.advance_ends_at) : time(meeting.ends_at);
  }

  if (key === "upcoming") {
    return status.nextPhase === "advance" ? time(meeting.advance_starts_at) : time(meeting.starts_at);
  }

  return time(meeting.closed_at ?? meeting.ends_at);
}

const roomOrder = new Intl.Collator("en", { numeric: true });

export function groupVoteRows<Row extends VoteRowLike>(
  rows: Row[],
  now: Date = new Date(),
): VoteGroup<Row>[] {
  const byMeeting = new Map<string, { key: GroupKey; at: number; rows: Row[] }>();

  for (const row of rows) {
    const existing = byMeeting.get(row.meeting_id);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    const status = getVotingWindowStatus(row.meetings, now);
    const key = groupOf(status);
    const at = row.meetings ? sortTime(key, row.meetings, status) : Number.NaN;

    byMeeting.set(row.meeting_id, { key, at, rows: [row] });
  }

  const order: GroupKey[] = ["open", "upcoming", "closed"];

  return order
    .map((key) => {
      const meetings = [...byMeeting.entries()]
        .filter(([, meeting]) => meeting.key === key)
        .sort(([, a], [, b]) => {
          // Unknown times go last. Closed: most recent first; the others:
          // soonest first.
          const missing = key === "closed" ? -Infinity : Infinity;
          const left = Number.isNaN(a.at) ? missing : a.at;
          const right = Number.isNaN(b.at) ? missing : b.at;

          if (left === right) {
            return 0;
          }

          return key === "closed" ? (right > left ? 1 : -1) : left > right ? 1 : -1;
        })
        .map(([meetingId, meeting]) => ({
          meetingId,
          rows: [...meeting.rows].sort((a, b) =>
            roomOrder.compare(a.rooms?.room_number ?? "", b.rooms?.room_number ?? ""),
          ),
        }));

      return { key, meetings };
    })
    .filter((group) => group.meetings.length > 0);
}
