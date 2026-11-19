// Admin overview (req_0008): which meetings to show "now", their turnout
// and quorum, and the counts of work waiting for the admin. Pure functions,
// so the rules are unit tested; the page only reads data and draws.
import { evaluateQuorum } from "@/features/results/pass-rules";

const DAY = 24 * 60 * 60 * 1000;

export type SpotlightMeetingLike = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  quorum_rule?: string | null;
};

/**
 * Meetings for the spotlight: published (not closed or archived) and either
 * open for voting now or opening within `horizonDays`. Open ones first, the
 * one closing soonest on top; then the ones opening soonest.
 */
export function spotlightMeetings<T extends SpotlightMeetingLike>(meetings: T[], now = new Date(), horizonDays = 7) {
  const time = now.getTime();
  const open = meetings.filter(
    (meeting) =>
      meeting.status === "published" && Date.parse(meeting.starts_at) <= time && time < Date.parse(meeting.ends_at),
  );
  const soon = meetings.filter((meeting) => {
    const starts = Date.parse(meeting.starts_at);

    return meeting.status === "published" && starts > time && starts <= time + horizonDays * DAY;
  });

  return [
    ...open
      .sort((left, right) => Date.parse(left.ends_at) - Date.parse(right.ends_at))
      .map((meeting) => ({ meeting, state: "open" as const })),
    ...soon
      .sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at))
      .map((meeting) => ({ meeting, state: "soon" as const })),
  ];
}

/** The draft to mention when nothing is open: the next one to start, else
 * the newest. */
export function nextDraftMeeting<T extends SpotlightMeetingLike>(meetings: T[], now = new Date()) {
  const drafts = meetings.filter((meeting) => meeting.status === "draft");
  const upcoming = drafts
    .filter((meeting) => Date.parse(meeting.starts_at) >= now.getTime())
    .sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at));

  return upcoming[0] ?? [...drafts].sort((left, right) => Date.parse(right.starts_at) - Date.parse(left.starts_at))[0] ?? null;
}

export type TurnoutInput = {
  /** eligible_voters_snapshot rows: one room can appear more than once. */
  eligible: { room_id: string; ownership_percent: number | string | null }[];
  /** Rooms with a submitted online ballot. */
  onlineRoomIds: Iterable<string>;
  /** Rooms with a counted (submitted) paper ballot. */
  paperRoomIds: Iterable<string>;
  quorumRule: string | null | undefined;
};

/**
 * Turnout so far, the way the result counts it (snapshot-payload): a room
 * counts once whether it voted online, on paper or both, weighted by its
 * eligible ownership; the quorum uses the meeting's rule (evaluateQuorum).
 * No choices or vote counts: nothing here reveals a result (D015).
 */
export function meetingTurnout(input: TurnoutInput) {
  const ownershipByRoom = new Map<string, number>();

  for (const row of input.eligible) {
    ownershipByRoom.set(row.room_id, Number(row.ownership_percent ?? 0) || 0);
  }

  const voted = new Set<string>();

  for (const roomId of [...input.onlineRoomIds, ...input.paperRoomIds]) {
    if (ownershipByRoom.has(roomId)) {
      voted.add(roomId);
    }
  }

  const totalOwnership = [...ownershipByRoom.values()].reduce((sum, value) => sum + value, 0);
  const votedOwnership = [...voted].reduce((sum, roomId) => sum + (ownershipByRoom.get(roomId) ?? 0), 0);

  return {
    roomsEligible: ownershipByRoom.size,
    roomsVoted: voted.size,
    ownershipTotal: totalOwnership,
    ownershipVoted: votedOwnership,
    quorum: evaluateQuorum(input.quorumRule ?? "", votedOwnership, totalOwnership),
  };
}

/** "2 d 3 h" / "3 h 5 min" / "12 min" between now and a time (never negative). */
export function timeUntil(
  target: string,
  words: { days: string; hours: string; minutes: string },
  now = new Date(),
) {
  const minutes = Math.max(0, Math.floor((Date.parse(target) - now.getTime()) / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const fillIn = (text: string, values: Record<string, number>) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

  return days > 0
    ? fillIn(words.days, { days, hours })
    : hours > 0
      ? fillIn(words.hours, { hours, minutes: minutes % 60 })
      : fillIn(words.minutes, { minutes });
}

export type AttentionInput = {
  profiles: { approval_status: string }[];
  proxyAuthorizations: { status: string }[];
  resultSnapshots: { id: string; meeting_id: string; generated_at: string }[];
  resultPublications: { meeting_id: string }[];
  pendingManualBallots: { id: string }[];
  onlineBallots: { meeting_id: string; room_id: string }[];
  /** Paper ballots that count (submitted, identity not pending). */
  countedPaperBallots: { meeting_id: string; room_id: string }[];
  resolutions: { meeting_id: string; room_id: string }[];
  /** Draft meetings still missing English (null when two languages are off). */
  englishDrafts: number | null;
};

/** Work waiting for the admin, as counts that each lead to a list. */
export function attentionCounts(input: AttentionInput) {
  const published = new Set(input.resultPublications.map((publication) => publication.meeting_id));
  const meetingsWithResult = new Set(input.resultSnapshots.map((snapshot) => snapshot.meeting_id));
  const online = new Set(input.onlineBallots.map((ballot) => `${ballot.meeting_id}:${ballot.room_id}`));
  const resolved = new Set(input.resolutions.map((resolution) => `${resolution.meeting_id}:${resolution.room_id}`));
  const twice = new Set(
    input.countedPaperBallots
      .map((ballot) => `${ballot.meeting_id}:${ballot.room_id}`)
      .filter((key) => online.has(key) && !resolved.has(key)),
  );

  return {
    pendingAccounts: input.profiles.filter((profile) => profile.approval_status === "pending").length,
    proxyRequests: input.proxyAuthorizations.filter((authorization) => authorization.status === "pending").length,
    // One per meeting: its newest result waits until the committee approves.
    pendingResults: [...meetingsWithResult].filter((meetingId) => !published.has(meetingId)).length,
    paperIdentity: input.pendingManualBallots.length,
    conflicts: twice.size,
    englishDrafts: input.englishDrafts,
  };
}
