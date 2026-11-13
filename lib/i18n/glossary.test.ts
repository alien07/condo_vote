import { describe, expect, it } from "vitest";
import { decidingColumn, GLOSSARY } from "@/lib/i18n/glossary";

describe("glossary", () => {
  it("has text for every term in both languages", () => {
    for (const locale of ["th", "en"] as const) {
      for (const entry of Object.values(GLOSSARY[locale])) {
        expect(entry.term.trim()).not.toBe("");
        expect(entry.text.trim()).not.toBe("");
      }
    }
  });

  it("marks the column a pass rule uses", () => {
    expect(decidingColumn("voting_ownership")).toBe("shareOfCast");
    expect(decidingColumn("total_ownership")).toBe("shareOfAll");
    expect(decidingColumn("none")).toBeNull();
    expect(decidingColumn(undefined)).toBeNull();
  });
});
