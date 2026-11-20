import { describe, expect, it } from "vitest";
import {
  attentionCounts,
  meetingTurnout,
  nextDraftMeeting,
  spotlightMeetings,
  timeUntil,
} from "@/features/admin/overview/overview-model";

const now = new Date("2026-11-20T03:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
const meeting = (id: string, status: string, start: number, end: number) => ({
  id,
  title: id,
  status,
  starts_at: at(start),
  ends_at: at(end),
});

describe("spotlightMeetings (req_0008)", () => {
  it("shows open meetings first, closing soonest on top, then ones opening within 7 days", () => {
    const result = spotlightMeetings(
      [
        meeting("open-late", "published", -2, 48),
        meeting("open-soon", "published", -1, 2),
        meeting("next-week", "published", 24 * 6, 24 * 6 + 2),
        meeting("too-far", "published", 24 * 8, 24 * 8 + 2),
        meeting("draft", "draft", -1, 2),
        meeting("closed", "closed", -1, 2),
        meeting("ended", "published", -5, -1),
      ],
      now,
    );

    expect(result.map((entry) => [entry.meeting.id, entry.state])).toEqual([
      ["open-soon", "open"],
      ["open-late", "open"],
      ["next-week", "soon"],
    ]);
  });

  it("picks the next draft to start, else the newest draft", () => {
    expect(nextDraftMeeting([meeting("d1", "draft", 48, 50), meeting("d2", "draft", 24, 26)], now)?.id).toBe("d2");
    expect(nextDraftMeeting([meeting("old", "draft", -48, -40), meeting("older", "draft", -96, -90)], now)?.id).toBe(
      "old",
    );
    expect(nextDraftMeeting([meeting("p", "published", 1, 2)], now)).toBeNull();
  });
});

describe("meetingTurnout", () => {
  const eligible = [
    { room_id: "r1", ownership_percent: 10 },
    { room_id: "r2", ownership_percent: "15" },
    { room_id: "r2", ownership_percent: "15" },
    { room_id: "r3", ownership_percent: 75 },
  ];

  it("counts a room once across online and paper, weighted by ownership", () => {
    const turnout = meetingTurnout({
      eligible,
      onlineRoomIds: ["r1", "r2", "not-eligible"],
      paperRoomIds: ["r2"],
      quorumRule: "one_fourth_total_ownership",
    });

    expect(turnout).toMatchObject({ roomsEligible: 3, roomsVoted: 2, ownershipTotal: 100, ownershipVoted: 25 });
    expect(turnout.quorum.met).toBe(true);
  });

  it("uses the meeting's quorum rule", () => {
    const base = { eligible, onlineRoomIds: ["r1"], paperRoomIds: [] };

    expect(meetingTurnout({ ...base, quorumRule: "one_third_total_ownership" }).quorum.met).toBe(false);
    expect(meetingTurnout({ ...base, quorumRule: "not_required_second_call" }).quorum.met).toBe(true);
    expect(meetingTurnout({ ...base, quorumRule: null }).quorum.met).toBeNull();
  });
});

describe("timeUntil", () => {
  const words = { days: "{days} d {hours} h", hours: "{hours} h {minutes} min", minutes: "{minutes} min" };

  it("reads days, hours or minutes, never negative", () => {
    expect(timeUntil(at(51), words, now)).toBe("2 d 3 h");
    expect(timeUntil(at(3.5), words, now)).toBe("3 h 30 min");
    expect(timeUntil(at(0.2), words, now)).toBe("12 min");
    expect(timeUntil(at(-1), words, now)).toBe("0 min");
  });
});

describe("attentionCounts", () => {
  it("counts only work that waits", () => {
    const counts = attentionCounts({
      profiles: [{ approval_status: "pending" }, { approval_status: "approved" }],
      proxyAuthorizations: [{ status: "pending" }, { status: "approved" }, { status: "pending" }],
      resultSnapshots: [
        { id: "s1", meeting_id: "m1", generated_at: at(-3) },
        { id: "s2", meeting_id: "m1", generated_at: at(-2) },
        { id: "s3", meeting_id: "m2", generated_at: at(-1) },
        { id: "s4", meeting_id: "m3", generated_at: at(-1) },
      ],
      resultPublications: [{ meeting_id: "m2" }],
      // m3 did not pass (D027): its own card, not "waiting for approval".
      resultDecisions: [
        { meeting_id: "m1", status: "open" },
        { meeting_id: "m3", status: "not_passed" },
      ],
      pendingManualBallots: [{ id: "p1" }],
      onlineBallots: [
        { meeting_id: "m1", room_id: "r1" },
        { meeting_id: "m1", room_id: "r2" },
      ],
      countedPaperBallots: [
        { meeting_id: "m1", room_id: "r1" },
        { meeting_id: "m1", room_id: "r2" },
        { meeting_id: "m1", room_id: "r3" },
      ],
      resolutions: [{ meeting_id: "m1", room_id: "r2" }],
      englishDrafts: null,
    });

    expect(counts).toEqual({
      pendingAccounts: 1,
      proxyRequests: 2,
      pendingResults: 1,
      notPassedResults: 1,
      paperIdentity: 1,
      conflicts: 1,
      englishDrafts: null,
    });
  });
});
