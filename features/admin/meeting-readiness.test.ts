import { describe, expect, it } from "vitest";
import {
  PUBLISH_NO_AGENDA,
  PUBLISH_NO_CHOICES,
  meetingReadiness,
  readinessMessage,
} from "@/features/admin/meeting-readiness";

describe("meetingReadiness", () => {
  it("needs at least one agenda item", () => {
    const readiness = meetingReadiness([]);

    expect(readiness).toEqual({ ready: false, noAgenda: true, withoutChoices: [] });
    expect(readinessMessage(readiness)).toBe(PUBLISH_NO_AGENDA);
  });

  it("does not count the default Abstain as a choice", () => {
    const readiness = meetingReadiness([
      { agenda_no: "1", question_text: "Approve budget", meeting_choices: [{ is_abstain: false }, { is_abstain: true }] },
      { agenda_no: "2", question_text: "Elect auditor", meeting_choices: [{ is_abstain: true }] },
      { question_text: "Other", meeting_choices: null },
    ]);

    expect(readiness.ready).toBe(false);
    expect(readiness.withoutChoices).toEqual(["2 Elect auditor", "Other"]);
    expect(readinessMessage(readiness)).toBe(PUBLISH_NO_CHOICES);
  });

  it("is ready when every item has a real choice", () => {
    const readiness = meetingReadiness([
      { agenda_no: "1", question_text: "Approve budget", meeting_choices: [{ is_abstain: false }] },
    ]);

    expect(readiness.ready).toBe(true);
    expect(readinessMessage(readiness)).toBeNull();
  });
});
