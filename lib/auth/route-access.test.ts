import { describe, expect, it } from "vitest";
import { canOpen, linkIfAllowed } from "@/lib/auth/route-access";

const staff = ["staff"];
const manager = ["admin"];

describe("canOpen (req_0009)", () => {
  it("lets office staff open only their pages", () => {
    for (const href of [
      "/admin",
      "/admin/people?tab=profiles",
      "/admin/people/import",
      "/admin/ownership?room=1",
      "/admin/voting",
      "/admin/voting/manual/m/r",
    ]) {
      expect(canOpen(href, staff), href).toBe(true);
    }

    for (const href of [
      "/admin/voting/conflicts?status=unresolved",
      "/admin/meetings?tab=meetings",
      "/admin/results",
      "/admin/proxies",
      "/admin/setup?tab=audit",
      "/admin/communications",
      "/admin/documents",
      "/admin/meetings/1/record",
    ]) {
      expect(canOpen(href, staff), href).toBe(false);
    }
  });

  it("lets the Manager open everything and others nothing under /admin", () => {
    expect(canOpen("/admin/setup", manager)).toBe(true);
    expect(canOpen("/admin/voting/conflicts", [...staff, ...manager])).toBe(true);
    expect(canOpen("/admin", ["committee"])).toBe(false);
    expect(canOpen("/admin", ["system_admin"])).toBe(false);
    expect(canOpen("/committee", staff)).toBe(true);
  });

  it("gives back the link or nothing", () => {
    expect(linkIfAllowed("/admin/results", manager)).toBe("/admin/results");
    expect(linkIfAllowed("/admin/results", staff)).toBeUndefined();
  });
});
