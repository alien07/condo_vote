import { describe, expect, it } from "vitest";
import { localized } from "@/lib/i18n/content";

describe("localized", () => {
  it("uses English on English pages when it was written", () => {
    expect(localized("en", "งบการเงิน", "Financial statements")).toBe("Financial statements");
  });

  it("falls back to Thai", () => {
    expect(localized("en", "งบการเงิน", null)).toBe("งบการเงิน");
    expect(localized("en", "งบการเงิน", " ")).toBe("งบการเงิน");
    expect(localized("th", "งบการเงิน", "Financial statements")).toBe("งบการเงิน");
  });
});
