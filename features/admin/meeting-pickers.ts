// Which meetings each admin form offers (2026-11-19). A form lists only the
// meetings where what it saves still means something; the server checks the
// same rule, and the database where it matters (0044). Proxies:
// proxy-meetings.ts. Agenda items: draft meetings only (0039).

export type PickerMeetingLike = { status: string; ends_at: string };

/** Paper ballots: a published meeting, during voting or after it ends
 * (ballots collected on the day or during an outage, operations.md), until
 * the result is generated, which closes the meeting. A draft has no voter
 * list yet, and a closed meeting already has its result. */
export function takesPaperBallots(meeting: PickerMeetingLike) {
  return meeting.status === "published";
}

export const PAPER_BALLOT_MEETING_CLOSED =
  "Paper ballots can only be entered for a published meeting whose result has not been generated.";

/** Vote links by email: a published meeting still open for voting. */
export function takesVoteInvitations(meeting: PickerMeetingLike, now = new Date()) {
  return meeting.status === "published" && new Date(meeting.ends_at).getTime() > now.getTime();
}

export const VOTE_INVITATION_MEETING_CLOSED =
  "Vote links can only be sent for a published meeting still open for voting.";

/** Voting still open at `now` (for the hint next to a meeting). */
export function votingOpen(meeting: PickerMeetingLike, now = new Date()) {
  return new Date(meeting.ends_at).getTime() > now.getTime();
}
