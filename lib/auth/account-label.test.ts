import { describe, expect, it } from "vitest";
import { accountLabel } from "@/lib/auth/account-label";

const text = {
  roles: { admin: "Admin", committee: "Committee", system_admin: "System admin" },
  statuses: { owner: "Owner", resident: "Resident", proxy: "Proxy holder" },
  user: "user",
};

describe("accountLabel", () => {
  it("puts job roles before the member status", () => {
    expect(accountLabel(["committee"], "resident", text)).toBe("Committee · Resident");
  });

  it("orders roles the same way every time", () => {
    expect(accountLabel(["system_admin", "admin"], "owner", text)).toBe(
      "Admin · System admin · Owner",
    );
  });

  it("shows only the status without roles", () => {
    expect(accountLabel([], "owner", text)).toBe("Owner");
  });

  it("falls back to the plain word", () => {
    expect(accountLabel([], null, text)).toBe("user");
  });
});
