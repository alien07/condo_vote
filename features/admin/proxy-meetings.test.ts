import { describe, expect, it } from "vitest";
import { takesNewProxy } from "@/features/admin/proxy-meetings";

const now = new Date("2026-11-19T00:00:00Z");

describe("takesNewProxy", () => {
  it("takes a draft meeting", () => {
    expect(takesNewProxy({ status: "draft", ends_at: "2026-01-01T00:00:00Z" }, now)).toBe(true);
  });

  it("takes a published meeting until voting closes", () => {
    expect(takesNewProxy({ status: "published", ends_at: "2026-11-20T00:00:00Z" }, now)).toBe(true);
    expect(takesNewProxy({ status: "published", ends_at: "2026-11-18T00:00:00Z" }, now)).toBe(false);
  });

  it("does not take closed, approved or archived meetings", () => {
    for (const status of ["closed", "approved", "archived"]) {
      expect(takesNewProxy({ status, ends_at: "2026-12-01T00:00:00Z" }, now)).toBe(false);
    }
  });
});
