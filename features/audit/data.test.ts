import { describe, expect, it } from "vitest";
import { auditHref } from "@/features/audit/audit-href";
import { auditListFilters, auditTabFromParam, bangkokDayRange } from "@/features/audit/data";

const meeting = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";

describe("audit page URL state (req_0007)", () => {
  it("reads the tab, the meeting id, dates and paging, and drops bad values", () => {
    expect(auditTabFromParam("log")).toBe("log");
    expect(auditTabFromParam("nope")).toBe("results");
    expect(auditListFilters({ meeting, from: "2026-11-01", to: "2026-11-30", page: "3", perPage: "50" })).toEqual({
      meeting,
      from: "2026-11-01",
      to: "2026-11-30",
      page: 3,
      perPage: 50,
    });
    expect(auditListFilters({ meeting: "Annual meeting", from: "1 Nov", page: "-1", perPage: "5000" })).toEqual({
      meeting: "",
      from: "",
      to: "",
      page: 1,
      perPage: 100,
    });
  });

  it("turns Bangkok days into a UTC range with an exclusive end", () => {
    expect(bangkokDayRange("2026-11-01", "2026-11-30")).toEqual({
      start: "2026-10-31T17:00:00.000Z",
      end: "2026-11-30T17:00:00.000Z",
    });
    expect(bangkokDayRange("", "")).toEqual({ start: null, end: null });
  });

  it("keeps the meeting on every tab link and leaves defaults out", () => {
    expect(auditHref({ tab: "corrections", meeting })).toBe(`/audit?tab=corrections&meeting=${meeting}`);
    expect(auditHref({ tab: "results", meeting: "", from: "2026-11-01", page: 2, perPage: 25 })).toBe(
      "/audit?tab=results&from=2026-11-01&page=2",
    );
  });
});
