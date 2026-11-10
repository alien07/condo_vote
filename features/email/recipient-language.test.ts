import { describe, expect, it } from "vitest";
import { withRecipientLanguage } from "@/features/email/recipient-language";
import { renderEmail, templateNameFromKey } from "@/features/email/templates";

describe("withRecipientLanguage", () => {
  it("uses each profile's language and Thai for everyone else", () => {
    const rows = withRecipientLanguage(
      [
        { recipient_email: "Owner.EN@example.test", template_key: "vote_invitation:m1" },
        { recipient_email: "owner.th@example.test", template_key: "vote_invitation:m1" },
        { recipient_email: "no.profile@example.test", template_key: "vote_fyi:m1" },
      ],
      [
        { email: "owner.en@example.test", preferred_language: "en" },
        { email: "owner.th@example.test", preferred_language: "th" },
      ],
    );

    expect(rows.map((row) => row.language)).toEqual(["en", "th", "th"]);
  });

  it("falls back to Thai for an unknown stored language", () => {
    const [row] = withRecipientLanguage(
      [{ recipient_email: "a@example.test" }],
      [{ email: "a@example.test", preferred_language: "fr" }],
    );

    expect(row.language).toBe("th");
  });
});

describe("email templates", () => {
  it("reads the template from the log key and fills placeholders", () => {
    expect(templateNameFromKey("vote_invitation:abc")).toBe("vote_invitation");
    expect(templateNameFromKey("unknown:abc")).toBeNull();

    const email = renderEmail("vote_invitation", "en", { meetingTitle: "AGM 2026" });

    expect(email.subject).toBe("Invitation to vote: AGM 2026");
    expect(email.body).toContain("{link}");
    expect(renderEmail("vote_invitation", "th").subject).toBe("เชิญลงคะแนน: {meetingTitle}");
  });
});
