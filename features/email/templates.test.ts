import { describe, expect, it } from "vitest";
import { renderEmail } from "@/features/email/templates";

describe("vote invitation", () => {
  it("links the owner guide in both languages", () => {
    const helpLink = "https://example.test/help/owner";

    expect(renderEmail("vote_invitation", "th", { helpLink }).body).toContain(
      `วิธีลงคะแนนทีละขั้น: ${helpLink}`,
    );
    expect(renderEmail("vote_invitation", "en", { helpLink }).body).toContain(
      `Step-by-step guide: ${helpLink}`,
    );
  });
});

describe("committee workflow emails", () => {
  it("has Thai and English text for every committee email", () => {
    for (const name of [
      "close_request",
      "close_request_failed",
      "result_correction",
      "result_correction_answered",
      "result_review_again",
      "co_owner_vote",
    ] as const) {
      expect(renderEmail(name, "th", { meetingTitle: "M1" }).subject).toContain("M1");
      expect(renderEmail(name, "en", { meetingTitle: "M1" }).subject).toContain("M1");
    }
  });
});
