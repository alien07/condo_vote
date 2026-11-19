import { describe, expect, it } from "vitest";
import {
  PENDING_ACCOUNTS_HREF,
  profileTableParams,
  profileTableStateFromParams,
} from "@/features/admin/components/sections/people/people-table-state";

describe("profile table approval filter (req_0004)", () => {
  it("reads ?approval= and ignores unknown values", () => {
    expect(profileTableStateFromParams(new URLSearchParams("approval=pending")).approval).toBe("pending");
    expect(profileTableStateFromParams(new URLSearchParams("approval=rejected")).approval).toBe("rejected");
    expect(profileTableStateFromParams(new URLSearchParams("approval=nope")).approval).toBe("all");
    expect(profileTableStateFromParams(new URLSearchParams("")).approval).toBe("all");
  });

  it("keeps the filter in the URL through paging and drops it for all", () => {
    const state = profileTableStateFromParams(new URLSearchParams("approval=pending&page=2&perPage=10"));

    expect(profileTableParams({ ...state, page: 3 })).toMatchObject({ approval: "pending", page: "3", perPage: "10" });
    expect(profileTableParams({ ...state, approval: "all" }).approval).toBeNull();
  });

  it("links the overview card to the Users tab with pending accounts only", () => {
    const url = new URL(PENDING_ACCOUNTS_HREF, "http://localhost");

    expect(url.pathname).toBe("/admin/people");
    expect(url.searchParams.get("tab")).toBe("profiles");
    expect(profileTableStateFromParams(url.searchParams).approval).toBe("pending");
  });
});
