import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appUrl, serviceKey, supabaseUrl } from "./admin/admin-helpers";
import { confirmInApp } from "./confirm-dialog";

// Notice period (req_0011 C, D027; Condominium Act s.42/3): a meeting less
// than 7 days away is published after a warning when the flag is off, and
// cannot be published when it is on.
test.describe("@test:e2e @test:system notice period", () => {
  test.skip(!supabaseUrl || !serviceKey, "Local Supabase service key is required.");

  test("warns when off, refuses when on", async ({ page }) => {
    test.setTimeout(180_000);

    const admin = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const stamp = Date.now();
    const email = `notice-manager-${stamp}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const { data: profile } = await admin
      .from("profiles")
      .insert({
        approval_status: "approved",
        auth_user_id: user.user!.id,
        default_status: "resident",
        email,
        full_name: `Notice manager ${stamp}`,
        preferred_language: "en",
      })
      .select("id")
      .single();

    expect((await admin.from("app_roles").insert({ profile_id: profile!.id, role: "admin" })).error).toBeNull();

    const { data: settings } = await admin
      .from("app_settings")
      .select("id, strict_notice_period")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const settingsId =
      settings?.id ?? (await admin.from("app_settings").insert({}).select("id").single()).data!.id;
    const strictBefore = settings?.strict_notice_period ?? false;
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
    const meetingIds: string[] = [];

    async function draftMeeting(title: string) {
      const { data: meeting } = await admin
        .from("meetings")
        .insert({ title, status: "draft", starts_at: inDays(3), ends_at: inDays(3.2) })
        .select("id")
        .single();
      const { data: question } = await admin
        .from("meeting_questions")
        .insert({ meeting_id: meeting!.id, question_text: "Approve the budget", question_type: "single_choice", required: true, display_order: 1 })
        .select("id")
        .single();

      await admin.from("meeting_choices").insert([
        { question_id: question!.id, choice_text: "Agree", display_order: 1 },
        { question_id: question!.id, choice_text: "Disagree", display_order: 2 },
      ]);
      meetingIds.push(meeting!.id);

      return meeting!.id;
    }

    try {
      await admin.from("app_settings").update({ strict_notice_period: false }).eq("id", settingsId);
      const warnTitle = `Notice warn ${stamp}`;
      const warnId = await draftMeeting(warnTitle);
      const blockTitle = `Notice block ${stamp}`;

      await draftMeeting(blockTitle);

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

      // Off: the confirm warns, publishing works and is audited.
      await page.goto(`${appUrl}/admin/meetings?title=${encodeURIComponent(warnTitle)}`);
      const warnRow = page.getByRole("row").filter({ hasText: warnTitle });

      await warnRow.getByRole("button", { name: "Publish" }).click();
      await confirmInApp(page, "less than 7 days away");
      await expect(warnRow.getByRole("cell", { name: "published", exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const { data } = await admin
            .from("audit_logs")
            .select("details_json")
            .eq("action", "meeting.published")
            .eq("entity_id", warnId)
            .maybeSingle();

          return (data?.details_json as { short_notice_confirmed?: boolean } | null)?.short_notice_confirmed ?? null;
        })
        .toBe(true);

      // On: no Publish button, the reason instead; the database refuses too.
      await admin.from("app_settings").update({ strict_notice_period: true }).eq("id", settingsId);
      await page.goto(`${appUrl}/admin/meetings?title=${encodeURIComponent(blockTitle)}`);
      const blockRow = page.getByRole("row").filter({ hasText: blockTitle });

      await expect(blockRow.locator("[data-notice-blocked]").first()).toContainText("less than 7 days away");
      await expect(blockRow.getByRole("button", { name: "Publish" })).toHaveCount(0);
    } finally {
      await admin.from("app_settings").update({ strict_notice_period: strictBefore }).eq("id", settingsId);
      await admin.from("eligible_voters_snapshot").delete().in("meeting_id", meetingIds);
      await admin.from("meetings").update({ status: "archived" }).in("id", meetingIds);
      await admin.from("app_roles").delete().eq("profile_id", profile!.id);
    }
  });
});
