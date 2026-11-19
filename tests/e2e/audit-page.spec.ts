import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  appUrl,
  chooseSearchOption,
  demoAdminEmail,
  findUserByEmail,
  serviceKey,
  supabaseUrl,
} from "./admin/admin-helpers";

// The audit page (req_0007), read by an auditor who is not an admin: tabs,
// one meeting filter by id for every tab, paging past the old 50/100 limits,
// and the activity log in words.
test.describe("@test:e2e @test:audit audit page", () => {
  test.skip(!supabaseUrl || !serviceKey, "Local Supabase service key is required.");

  test("an auditor finds one meeting's evidence across the tabs", async ({ page }) => {
    test.setTimeout(180_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const stamp = Date.now();
    const auditorEmail = `auditor-${stamp}@example.test`;
    const meetingTitle = `Audit page meeting ${stamp}`;
    const otherTitle = `Audit page other ${stamp}`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: auditorEmail,
      email_confirm: true,
    });

    expect(authError).toBeNull();

    const { data: auditor, error: auditorError } = await supabase
      .from("profiles")
      .insert({
        approval_status: "approved",
        auth_user_id: authUser.user!.id,
        default_status: "resident",
        email: auditorEmail,
        full_name: `Auditor ${stamp}`,
        preferred_language: "en",
      })
      .select("id")
      .single();

    expect(auditorError).toBeNull();
    expect((await supabase.from("app_roles").insert({ profile_id: auditor!.id, role: "auditor" })).error).toBeNull();

    // A requester for the correction requests: the demo admin's profile.
    const adminUser = await findUserByEmail(supabase, demoAdminEmail);
    const { data: requester } = adminUser
      ? await supabase.from("profiles").select("id").eq("auth_user_id", adminUser.id).maybeSingle()
      : { data: null };
    const requesterId = requester?.id ?? auditor!.id;
    const past = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const { data: meetings, error: meetingError } = await supabase
      .from("meetings")
      .insert([
        { ends_at: past(1), published_at: past(3), starts_at: past(2), status: "closed", title: meetingTitle },
        { ends_at: past(1), published_at: past(3), starts_at: past(2), status: "closed", title: otherTitle },
      ])
      .select("id, title");

    expect(meetingError).toBeNull();

    const meeting = meetings!.find((row) => row.title === meetingTitle)!;
    const other = meetings!.find((row) => row.title === otherTitle)!;
    const { data: snapshots, error: snapshotError } = await supabase
      .from("result_snapshots")
      .insert([
        { meeting_id: meeting.id, payload_json: {} },
        { meeting_id: other.id, payload_json: {} },
      ])
      .select("id, meeting_id");

    expect(snapshotError).toBeNull();

    const snapshot = snapshots!.find((row) => row.meeting_id === meeting.id)!;
    const otherSnapshot = snapshots!.find((row) => row.meeting_id === other.id)!;

    try {
      expect(
        (
          await supabase.from("result_publications").insert([
            { approvals_count: 2, meeting_id: meeting.id, result_snapshot_id: snapshot.id },
            { approvals_count: 1, meeting_id: other.id, result_snapshot_id: otherSnapshot.id },
          ])
        ).error,
      ).toBeNull();
      expect(
        (
          await supabase.from("result_documents").insert({
            byte_size: 1,
            kind: "official",
            language: "th",
            result_snapshot_id: snapshot.id,
            sha256: "a".repeat(64),
            storage_path: `${snapshot.id}/official-th.pdf`,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await supabase.from("result_correction_requests").insert([
            {
              category: "room_data",
              legal_reference: "Condominium Act section 48",
              level: "high",
              meeting_id: meeting.id,
              reason: `Share of room A-101 is wrong ${stamp}`,
              requested_by: requesterId,
              result_snapshot_id: snapshot.id,
            },
            {
              category: "wording",
              level: "low",
              meeting_id: other.id,
              reason: `Typo ${stamp}`,
              requested_by: requesterId,
              result_snapshot_id: otherSnapshot.id,
            },
          ])
        ).error,
      ).toBeNull();
      // 120 log rows about the meeting (more than the old limit of 100) and
      // one about the other meeting.
      expect(
        (
          await supabase.from("audit_logs").insert([
            ...Array.from({ length: 120 }, (_, index) => ({
              action: "result.correction_level_raised",
              actor_profile_id: requesterId,
              created_at: past(index / 60),
              details_json: { meeting_id: meeting.id, from: "low", to: "high", reason: `row ${index}` },
              entity_id: snapshot.id,
              entity_type: "result_snapshot",
            })),
            {
              action: "result.correction_level_raised",
              actor_profile_id: requesterId,
              created_at: past(0),
              details_json: { meeting_id: other.id, from: "low", to: "medium" },
              entity_id: otherSnapshot.id,
              entity_type: "result_snapshot",
            },
          ])
        ).error,
      ).toBeNull();

      const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
        email: auditorEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

      expect(linkError).toBeNull();
      await page.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(link.properties!.hashed_token)}&type=${
          link.properties!.verification_type
        }`,
      );

      // Published results: pick the meeting; the URL carries its id.
      await page.goto(`${appUrl}/audit`);
      await expect(page.getByRole("heading", { level: 1, name: "Audit" })).toBeVisible();
      const meetingForm = page.locator("form[data-audit-meeting]");

      await chooseSearchOption(meetingForm, "meeting", meetingTitle);
      await meetingForm.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("meeting") === meeting.id);
      const publications = page.locator("[data-publication-id]");

      await expect(publications).toHaveCount(1);
      await expect(publications.first()).toContainText(meetingTitle);
      await expect(publications.first()).toContainText("Approved by 2");
      await expect(publications.first().getByRole("link", { name: "Download official PDF" })).toHaveAttribute(
        "href",
        `/result-files/${snapshot.id}/official-th.pdf`,
      );
      await expect(publications.first().getByRole("link", { name: "View record (web page)" })).toHaveAttribute(
        "href",
        `/record/${snapshot.id}?from=audit`,
      );

      // Every button on the tab is at least 40 px high.
      for (const box of await page.locator("main a[class*='min-h'], main button").evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => element.getBoundingClientRect().height),
      )) {
        expect(box).toBeGreaterThanOrEqual(40);
      }

      // Correction requests: the same meeting only, level and status as badges.
      await page.locator('[data-audit-tab="corrections"]').click();
      await page.waitForURL((url) => url.searchParams.get("tab") === "corrections" && url.searchParams.get("meeting") === meeting.id);
      const corrections = page.locator("[data-correction-id]");

      await expect(corrections).toHaveCount(1);
      await expect(corrections.first()).toContainText(meetingTitle);
      await expect(corrections.first().locator('[data-level="high"]')).toHaveText("Level: High");
      await expect(corrections.first()).toContainText("Room data or ownership share");
      await expect(corrections.first()).not.toContainText(otherTitle);

      // Activity log: the meeting's 120 rows, in words, paged past 100.
      await page.locator('[data-audit-tab="log"]').click();
      await page.waitForURL((url) => url.searchParams.get("tab") === "log" && url.searchParams.get("meeting") === meeting.id);
      await expect(page.getByText("Showing 1-25 of 120")).toBeVisible();
      const visibleRows = page.locator("[data-audit-cards] li, #audit table tbody tr, table tbody tr").filter({ visible: true });

      await expect(visibleRows.first()).toContainText("Correction request level raised");
      await expect(page.locator("[data-audit-details]:visible").first()).toContainText("From: Low");
      await expect(page.locator("main")).not.toContainText("result.correction_level_raised");

      await page.locator('select[aria-label="Per page"]:visible').first().selectOption("100");
      await expect(page.getByText("Showing 1-100 of 120")).toBeVisible();
      await page.locator('select[aria-label="Page"]:visible').first().selectOption("2");
      await expect(page.getByText("Showing 101-120 of 120")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`[?&]meeting=${meeting.id}`));

      // No horizontal scroll at the three widths.
      for (const width of [1440, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });

        for (const tab of ["results", "corrections", "log"]) {
          await page.goto(`${appUrl}/audit?tab=${tab}&meeting=${meeting.id}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
            `${width}px ${tab}`,
          ).toBeLessThanOrEqual(0);
        }
      }
    } finally {
      await supabase.from("audit_logs").delete().in("entity_id", [snapshot.id, otherSnapshot.id]);
      await supabase.from("result_correction_requests").delete().in("meeting_id", [meeting.id, other.id]);
      await supabase.from("result_documents").delete().eq("result_snapshot_id", snapshot.id);
      await supabase.from("result_publications").delete().in("meeting_id", [meeting.id, other.id]);
      await supabase.from("result_snapshots").delete().in("meeting_id", [meeting.id, other.id]);
      await supabase.from("meetings").delete().in("id", [meeting.id, other.id]);
      await supabase.from("app_roles").delete().eq("profile_id", auditor!.id);
      await supabase.from("profiles").delete().eq("id", auditor!.id);
      await supabase.auth.admin.deleteUser(authUser.user!.id);
    }
  });
});
