import { describe, expect, it } from "vitest";
import { emailTemplateLabel } from "@/features/email/template-label";

const titles = new Map([["m1", "DEMO M8"]]);

describe("emailTemplateLabel", () => {
  it("names the email by its subject and meeting, in the page language", () => {
    expect(emailTemplateLabel("result_approved:m1", "en", titles)).toBe("Voting results: DEMO M8");
    expect(emailTemplateLabel("vote_invitation:m1", "th", titles)).toBe("เชิญลงคะแนน: DEMO M8");
  });

  it("shows a dash for a meeting it does not know", () => {
    expect(emailTemplateLabel("vote_fyi:gone", "en", titles)).toBe("Meeting notice: -");
  });

  it("keeps the code of an unknown template", () => {
    expect(emailTemplateLabel("something_else:m1", "en", titles)).toBe("something_else:m1");
  });
});
