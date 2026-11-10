// Voting window of a meeting. Voting runs in up to two phases: an optional
// advance window before the meeting day, then the meeting-day window
// (starts_at to ends_at). The voting core service enforces the same rule.

export type VotingPhase = "advance" | "meeting";

export type VotingWindowStatus = {
  label: "Not open yet" | "Open" | "Closed" | "Unavailable";
  canSubmit: boolean;
  /** The phase that is open now. */
  phase: VotingPhase | null;
  /** When not open yet: the phase that opens next. */
  nextPhase: VotingPhase | null;
};

type MeetingWindow = {
  status: string;
  starts_at: string;
  ends_at: string;
  advance_starts_at?: string | null;
  advance_ends_at?: string | null;
};

const closed = (label: VotingWindowStatus["label"]): VotingWindowStatus => ({
  label,
  canSubmit: false,
  phase: null,
  nextPhase: null,
});

export function getVotingWindowStatus(
  meeting: MeetingWindow | null,
  now: Date = new Date(),
): VotingWindowStatus {
  if (!meeting) {
    return closed("Unavailable");
  }

  if (meeting.status === "closed") {
    return closed("Closed");
  }

  if (meeting.status !== "published") {
    return closed("Unavailable");
  }

  const time = now.getTime();
  const advanceStart = meeting.advance_starts_at ? Date.parse(meeting.advance_starts_at) : null;
  const advanceEnd = meeting.advance_ends_at ? Date.parse(meeting.advance_ends_at) : null;
  const meetingStart = Date.parse(meeting.starts_at);
  const meetingEnd = Date.parse(meeting.ends_at);

  if (time >= meetingStart && time <= meetingEnd) {
    return { label: "Open", canSubmit: true, phase: "meeting", nextPhase: null };
  }

  if (advanceStart !== null && advanceEnd !== null && time >= advanceStart && time <= advanceEnd) {
    return { label: "Open", canSubmit: true, phase: "advance", nextPhase: null };
  }

  if (time > meetingEnd) {
    return closed("Closed");
  }

  // Before advance voting, or between the two phases.
  return {
    label: "Not open yet",
    canSubmit: false,
    phase: null,
    nextPhase: advanceStart !== null && time < advanceStart ? "advance" : "meeting",
  };
}
