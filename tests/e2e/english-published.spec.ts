import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appUrl, serviceKey, supabaseUrl } from "./admin/admin-helpers";
import { confirmInApp } from "./confirm-dialog";

// A published meeting whose English nobody checked (user decision
// 2026-11-21): its own card on the Manager's overview, and "Keep as it is"
// on its English page; missing English then shows in Thai.
test.describe("@test:e2e @test:admin english after publishing", () => {
  test.skip(!supabaseUrl || !serviceKey, "Local Supabase service key is required.");

  test("the Manager keeps the English of a published meeting as it is", async ({ page }) => {
    test.setTimeout(180_000);

    const admin = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const stamp = Date.now();
    const email = `english-manager-${stamp}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const { data: profile } = await admin
      .from("profiles")
      .insert({
        approval_status: "approved",
        auth_user_id: user.user!.id,
        default_status: "resident",
        email,
        full_name: `English manager ${stamp}`,
        preferred_language: "en",
      })
      .select("id")
      .single();

    expect((await admin.from("app_roles").insert({ profile_id: profile!.id, role: "admin" })).error).toBeNull();

    // Two languages on for this test; put back as it was afterwards.
    const { data: condo } = await admin.from("condo_profiles").select("id, bilingual_documents").limit(1).maybeSingle();
    const condoId =
      condo?.id ??
      (
        await admin
          .from("condo_profiles")
          .insert({ project_name: `E2E condo ${stamp}`, juristic_name: `E2E juristic ${stamp}` })
          .select("id")
          .single()
      ).data!.id;
    const bilingualBefore = condo?.bilingual_documents ?? false;
    const createdCondo = !condo;
    const title = `English published ${stamp}`;
    const hour = 3_600_000;
    const { data: meeting } = await admin
      .from("meetings")
      .insert({
        title,
        status: "published",
        published_at: new Date(Date.now() - hour).toISOString(),
        starts_at: new Date(Date.now() - hour).toISOString(),
        ends_at: new Date(Date.now() + 24 * hour).toISOString(),
      })
      .select("id")
      .single();

    try {
      await admin.from("condo_profiles").update({ bilingual_documents: true }).eq("id", condoId);

      const { data: link } = await admin.auth.admin.generateLink({
        email,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

      await page.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(link.properties!.hashed_token)}&type=${
          link.properties!.verification_type
        }`,
      );

      // Its own card, apart from the drafts card.
      await page.goto(`${appUrl}/admin`);
      await expect(
        page.locator('[data-overview-group="attention"]').getByText("Published meetings: English not checked"),
      ).toBeVisible();

      // Keep as it is on the meeting's English page.
      await page.goto(`${appUrl}/admin/meetings/${meeting!.id}/english`);
      const keep = page.locator("[data-english-keep]");

      await keep.getByRole("button", { name: "Keep as it is (no change)" }).click();
      await confirmInApp(page, "owners see the Thai text");
      await page.waitForURL(/feedback=success/);
      await expect(page.locator("[data-english-keep]")).toHaveCount(0);

      const { data: after } = await admin
        .from("meetings")
        .select("title_en, english_checked_at, english_checked_by")
        .eq("id", meeting!.id)
        .single();

      expect(after?.title_en).toBeNull();
      expect(after?.english_checked_at).not.toBeNull();
      expect(after?.english_checked_by).toBe(profile!.id);
      const { count } = await admin
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", "meeting.english_kept_as_is")
        .eq("entity_id", meeting!.id);

      expect(count).toBe(1);
    } finally {
      if (createdCondo) {
        await admin.from("condo_profiles").delete().eq("id", condoId);
      } else {
        await admin.from("condo_profiles").update({ bilingual_documents: bilingualBefore }).eq("id", condoId);
      }
      await admin.from("meetings").update({ status: "archived" }).eq("id", meeting!.id);
      await admin.from("app_roles").delete().eq("profile_id", profile!.id);
    }
  });
});
