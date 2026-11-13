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
