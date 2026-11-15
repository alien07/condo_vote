import { test } from "@playwright/test";
import { supabaseUrl, serviceKey } from "./admin-helpers";
import { fixtures } from "./lifecycle/setup";
import { access } from "./lifecycle/access";
import { setupPages } from "./lifecycle/setup-pages";
import { meetings } from "./lifecycle/meetings";
import { people } from "./lifecycle/people";
import { proxies } from "./lifecycle/proxies";
import { voting } from "./lifecycle/voting";
import { identityConflicts } from "./lifecycle/identity-conflicts";
import { results } from "./lifecycle/results";

test.describe("@test:e2e @test:auth @test:admin admin demo: lifecycle (@full)", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  // End-to-end admin lifecycle. Tagged @full: it runs only in full-suite runs,
  // not in per-PR smoke tests. See docs/testing.md.
  test(
    "demo admin can sign in and manage master data",
    { tag: "@full" },
    async ({ page }) => {
    test.setTimeout(900_000);

    // One end-to-end test; each step lives in ./lifecycle/, one file per feature.
    const ctx = await fixtures(page);
    await access(page, ctx);
    await setupPages(page, ctx);
    await meetings(page, ctx);
    await people(page, ctx);
    await proxies(page, ctx);
    const ctx6 = { ...ctx, ...(await voting(page, ctx)) };
    await identityConflicts(page, ctx6);
    await results(page, ctx6);
  });
});
