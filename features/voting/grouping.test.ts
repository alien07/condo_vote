import { describe, expect, it } from "vitest";
import { groupVoteRows } from "@/features/voting/grouping";

const now = new Date("2026-11-13T12:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();

function row(meetingId: string, room: string, meeting: Record<string, unknown>) {
  return {
    meeting_id: meetingId,
    room_id: `${meetingId}-${room}`,
    rooms: { room_number: room },
    meetings: { status: "published", ...meeting } as {
      status: string;
      starts_at: string;
      ends_at: string;
    },
  };
}

describe("groupVoteRows", () => {
  it("puts open meetings first, closing soonest first", () => {
    const groups = groupVoteRows(
      [
        row("closed", "A-101", { starts_at: hours(-50), ends_at: hours(-48) }),
        row("late", "A-101", { starts_at: hours(-1), ends_at: hours(10) }),
        row("soon", "A-101", { starts_at: hours(-1), ends_at: hours(2) }),
        row("next", "A-101", { starts_at: hours(5), ends_at: hours(9) }),
      ],
      now,
    );

    expect(groups.map((group) => group.key)).toEqual(["open", "upcoming", "closed"]);
    expect(groups[0].meetings.map((meeting) => meeting.meetingId)).toEqual(["soon", "late"]);
  });

  it("orders coming-up meetings by the next opening, advance voting included", () => {
    const groups = groupVoteRows(
      [
        row("day", "A-101", { starts_at: hours(5), ends_at: hours(9) }),
        row("advance", "A-101", {
          advance_starts_at: hours(3),
          advance_ends_at: hours(4),
          starts_at: hours(30),
          ends_at: hours(33),
        }),
      ],
      now,
    );

    expect(groups[0].meetings.map((meeting) => meeting.meetingId)).toEqual(["advance", "day"]);
  });

  it("shows the most recently closed first and keeps rooms in number order", () => {
    const groups = groupVoteRows(
      [
        row("old", "A-101", { status: "closed", starts_at: hours(-90), ends_at: hours(-88) }),
        row("recent", "A-110", { status: "closed", starts_at: hours(-10), ends_at: hours(-8) }),
        row("recent", "A-102", { status: "closed", starts_at: hours(-10), ends_at: hours(-8) }),
        row("recent", "A-9", { status: "closed", starts_at: hours(-10), ends_at: hours(-8) }),
      ],
      now,
    );

    expect(groups[0].key).toBe("closed");
    expect(groups[0].meetings.map((meeting) => meeting.meetingId)).toEqual(["recent", "old"]);
    expect(groups[0].meetings[0].rows.map((item) => item.rooms.room_number)).toEqual([
      "A-9",
      "A-102",
      "A-110",
    ]);
  });
});
