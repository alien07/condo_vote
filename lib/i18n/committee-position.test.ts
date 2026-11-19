import { describe, expect, it } from "vitest";
import { getStaffDictionary } from "@/lib/i18n/staff";
import {
  COMMITTEE_POSITION_CODES,
  committeePositionLabel,
  committeePositionRank,
  isCommitteePositionCode,
} from "@/lib/i18n/committee-position";

const en = getStaffDictionary("en").setup.positions;
const th = getStaffDictionary("th").setup.positions;

describe("committee positions", () => {
  it("has a Thai and an English label for every code", () => {
    for (const code of COMMITTEE_POSITION_CODES) {
      expect(en[code]).toBeTruthy();
      expect(th[code]).toBeTruthy();
    }
    expect(th.chair).toBe("ประธานกรรมการ");
    expect(en.assistant_secretary).toBe("Assistant secretary");
  });

  it("shows the label of the code in the page language", () => {
    expect(committeePositionLabel(en, "chair", null)).toBe("Chairperson");
    expect(committeePositionLabel(th, "chair", null)).toBe("ประธานกรรมการ");
  });

  it("shows the typed title for other", () => {
    expect(committeePositionLabel(th, "other", " ฝ่ายอาคาร ")).toBe("ฝ่ายอาคาร");
    expect(committeePositionLabel(en, "other", "")).toBe("-");
  });

  it("checks codes and orders chair first, other last", () => {
    expect(isCommitteePositionCode("treasurer")).toBe(true);
    expect(isCommitteePositionCode("auditor")).toBe(false);
    expect(committeePositionRank("chair")).toBeLessThan(committeePositionRank("member"));
    expect(committeePositionRank("other")).toBeLessThan(committeePositionRank("unknown"));
  });
});
