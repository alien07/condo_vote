import { describe, expect, it } from "vitest";
import { choiceLabel } from "@/lib/i18n/choice";

describe("choiceLabel", () => {
  it("translates the default Abstain choice", () => {
    expect(choiceLabel("Abstain", true, "th")).toBe("งดออกเสียง");
    expect(choiceLabel("Abstain", true, "en")).toBe("Abstain");
  });

  it("keeps names the admin typed", () => {
    expect(choiceLabel("ไม่ออกเสียง", true, "en")).toBe("ไม่ออกเสียง");
    expect(choiceLabel("Abstain", false, "th")).toBe("Abstain");
    expect(choiceLabel("เห็นด้วย", false, "en")).toBe("เห็นด้วย");
  });
});
