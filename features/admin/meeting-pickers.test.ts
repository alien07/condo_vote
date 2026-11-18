import { describe, expect, it } from "vitest";
import { takesPaperBallots, takesVoteInvitations } from "@/features/admin/meeting-pickers";

const now = new Date("2026-11-19T00:00:00Z");
const open = "2026-11-20T00:00:00Z";
const ended = "2026-11-18T00:00:00Z";

describe("takesPaperBallots", () => {
  it("takes a published meeting, during voting and after it ends", () => {
    expect(takesPaperBallots({ status: "published", ends_at: open })).toBe(true);
    expect(takesPaperBallots({ status: "published", ends_at: ended })).toBe(true);
  });

  it("does not take a draft, or a meeting that already has its result", () => {
    for (const status of ["draft", "closed", "archived"]) {
      expect(takesPaperBallots({ status, ends_at: open })).toBe(false);
    }
  });
});

describe("takesVoteInvitations", () => {
  it("takes a published meeting until voting closes", () => {
    expect(takesVoteInvitations({ status: "published", ends_at: open }, now)).toBe(true);
    expect(takesVoteInvitations({ status: "published", ends_at: ended }, now)).toBe(false);
  });

  it("does not take draft, closed or archived meetings", () => {
    for (const status of ["draft", "closed", "archived"]) {
      expect(takesVoteInvitations({ status, ends_at: open }, now)).toBe(false);
    }
  });
});
