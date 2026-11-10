import { describe, expect, it } from "vitest";
import { getVotingWindowStatus } from "@/features/voting/status";

const meeting = {
  status: "published",
  advance_starts_at: "2026-11-01T02:00:00Z",
  advance_ends_at: "2026-11-05T10:00:00Z",
  starts_at: "2026-11-07T02:00:00Z",
  ends_at: "2026-11-07T06:00:00Z",
};

const at = (iso: string) => getVotingWindowStatus(meeting, new Date(iso));

describe("voting window with an advance phase", () => {
  it("is not open before advance voting", () => {
    expect(at("2026-10-31T00:00:00Z")).toMatchObject({ canSubmit: false, nextPhase: "advance" });
  });

  it("is open during advance voting", () => {
    expect(at("2026-11-03T00:00:00Z")).toMatchObject({ canSubmit: true, phase: "advance" });
  });

  it("pauses between the phases", () => {
    expect(at("2026-11-06T00:00:00Z")).toMatchObject({
      label: "Not open yet",
      canSubmit: false,
      nextPhase: "meeting",
    });
  });

  it("is open on the meeting day", () => {
    expect(at("2026-11-07T03:00:00Z")).toMatchObject({ canSubmit: true, phase: "meeting" });
  });

  it("closes after the meeting day", () => {
    expect(at("2026-11-07T07:00:00Z")).toMatchObject({ label: "Closed", canSubmit: false });
  });

  it("works without an advance phase", () => {
    const single = { ...meeting, advance_starts_at: null, advance_ends_at: null };

    expect(getVotingWindowStatus(single, new Date("2026-11-03T00:00:00Z"))).toMatchObject({
      canSubmit: false,
      nextPhase: "meeting",
    });
  });
});
