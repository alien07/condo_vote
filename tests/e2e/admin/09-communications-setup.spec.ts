import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  gotoWithRetry,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: communications and setup", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("communications rollout opens email log details drawer", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: {
          full_name: demoAdminName,
        },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    expect(user).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          preferred_language: "en",
          email: demoAdminEmail,
          full_name: demoAdminName,
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();

    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        // Storage settings need the system admin role (D016).
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const runId = Date.now();
    const recipientEmail = `communications-rollout-${runId}@example.com`;
    const templateKey = `vote_fyi:${runId}`;

    const { data: emailLog, error: emailLogError } = await supabase
      .from("email_logs")
      .insert({
        error_message: "SMTP mock failure for rollout test",
        recipient_email: recipientEmail,
        status: "failed",
        template_key: templateKey,
      })
      .select("id")
      .single();

    expect(emailLogError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
        type: "magiclink",
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    await gotoWithRetry(
      page,
      `${appUrl}/admin/communications?recipient=${encodeURIComponent(
        recipientEmail,
      )}&sort=recipient&dir=asc&perPage=25`,
      { waitUntil: "commit" },
    );

    const logRow = page.getByRole("row").filter({ hasText: recipientEmail });

    await expect(logRow.getByRole("cell", { name: "failed" })).toBeVisible();
    const detailHref = await logRow
      .getByRole("link", { name: "View details" })
      .getAttribute("href");

    expect(detailHref).toContain("mode=view&type=email_log");
    await gotoWithRetry(page, new URL(detailHref!, appUrl).toString(), {
      waitUntil: "commit",
    });

    const detailDrawer = page.getByRole("dialog", {
      name: "Email log details",
    });

    await expect(detailDrawer).toBeVisible();
    await expect(detailDrawer.getByText(recipientEmail, { exact: true }))
      .toBeVisible();
    await expect(detailDrawer.getByText(templateKey, { exact: true }))
      .toBeVisible();
    await expect(
      detailDrawer.getByText("SMTP mock failure for rollout test"),
    ).toBeVisible();
    // No profile for this recipient, so the email is Thai (D020).
    await expect(detailDrawer.getByText("Thai", { exact: true })).toBeVisible();
    await expect(
      detailDrawer.getByText("แจ้งการประชุม: {meetingTitle}"),
    ).toBeVisible();

    await gotoWithRetry(
      page,
      `${appUrl}/admin/communications?recipient=${encodeURIComponent(
        recipientEmail,
      )}&sort=recipient&dir=asc&perPage=25&focusEmailLogId=${emailLog!.id}`,
      { waitUntil: "commit" },
    );

    await expect(page.getByRole("row").filter({ hasText: recipientEmail }))
      .toHaveClass(/border-l-\[var\(--primary\)\]/);
  });

  test("setup settings rollout validates and saves inline forms", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: {
          full_name: demoAdminName,
        },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    expect(user).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          preferred_language: "en",
          email: demoAdminEmail,
          full_name: demoAdminName,
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();

    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        // Storage settings need the system admin role (D016).
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
        type: "magiclink",
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    await gotoWithRetry(page, `${appUrl}/admin/setup`, {
      waitUntil: "commit",
    });

    const stamp = Date.now();
    const juristicSection = page
      .getByRole("heading", { name: "Juristic Person" })
      .locator("xpath=ancestor::section[1]");
    const juristicName = juristicSection.locator('input[name="juristic_name"]');
    const projectName = juristicSection.locator('input[name="project_name"]');

    await juristicName.fill("");
    await projectName.fill(`Rollout Condo ${stamp}`);
    await juristicSection
      .getByRole("button", { name: "Save juristic profile" })
      .click();

    await expect(
      juristicSection.getByText("Juristic person name is required."),
    ).toBeVisible();
    await expect(juristicName).toBeFocused();
    await expect(projectName).toHaveValue(`Rollout Condo ${stamp}`);

    await juristicName.fill(`Rollout Juristic ${stamp}`);
    await juristicSection.locator('input[name="summary_history_limit"]').fill("6");
    await juristicSection
      .getByRole("button", { name: "Save juristic profile" })
      .click();
    await expect(
      juristicSection.getByText("Juristic profile saved"),
    ).toBeVisible();

    await gotoWithRetry(page, `${appUrl}/admin/setup?tab=storage`, {
      waitUntil: "commit",
    });

    const storageSection = page
      .getByRole("heading", { name: "Document Storage" })
      .locator("xpath=ancestor::section[1]");

    await storageSection
      .locator('select[name="document_storage_provider"]')
      .selectOption("local_drive");
    await storageSection
      .locator('input[name="document_storage_root"]')
      .fill(`/private/condovotes-rollout-${stamp}`);
    await storageSection
      .getByRole("button", { name: "Save document storage config" })
      .click();
    await expect(
      storageSection.getByText("Document storage config saved"),
    ).toBeVisible();
  });
  test("setup page: labelled fields, audit log in words, no overflow at 1440, 768 and 375 px", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          email: demoAdminEmail,
          full_name: demoAdminName,
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase
      .from("app_roles")
      .upsert({ profile_id: profile!.id, role: "admin" }, { onConflict: "profile_id,role" });

    expect(roleError).toBeNull();

    // One audit row with ids and codes in its details, as the database writes them.
    const snapshotId = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const { data: auditRow, error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        action: "result.correction_answered",
        actor_profile_id: profile!.id,
        details_json: {
          meeting_id: "1a2b3c4d-1111-4222-8333-444455556666",
          request_id: "9f8e7d6c-1111-4222-8333-444455556666",
          result_snapshot_id: snapshotId,
          status: "fixed",
          answer: "Recounted room A-101; the total is right.",
        },
        entity_id: snapshotId,
        entity_type: "result_snapshot",
      })
      .select("id")
      .single();

    expect(auditError).toBeNull();
    // A level change, stored as codes (req_0002).
    const { data: levelRow, error: levelError } = await supabase
      .from("audit_logs")
      .insert({
        action: "result.correction_level_raised",
        actor_profile_id: profile!.id,
        details_json: { from: "low", to: "high", reason: "low turnout", request_id: snapshotId },
        entity_id: snapshotId,
        entity_type: "result_snapshot",
      })
      .select("id")
      .single();

    expect(levelError).toBeNull();

    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      email: demoAdminEmail,
      options: { redirectTo: `${appUrl}/auth/callback` },
      type: "magiclink",
    });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    try {
      // Juristic profile: every field has a visible label.
      await gotoWithRetry(page, `${appUrl}/admin/setup`, { waitUntil: "domcontentloaded" });
      const juristicSection = page
        .getByRole("heading", { name: "Juristic Person" })
        .locator("xpath=ancestor::section[1]");

      for (const label of [
        "Registration no.",
        "Tax ID",
        "Juristic manager",
        "Phone",
        "Email",
        "Address",
        "Document footer",
      ]) {
        await expect(juristicSection.getByLabel(label, { exact: true })).toBeVisible();
      }
      await expect(juristicSection.getByLabel("Email", { exact: true })).toHaveAttribute("type", "email");
      for (const legend of ["Registration", "Contact", "Documents"]) {
        await expect(juristicSection.getByRole("group", { name: legend, exact: true })).toBeVisible();
      }

      // Audit log: actions and records in words, details as label: value.
      const auditUrl = `${appUrl}/admin/setup?tab=audit&actions=result.correction_answered`;

      await gotoWithRetry(page, auditUrl, { waitUntil: "domcontentloaded" });
      const auditSection = page
        .getByRole("heading", { name: "Business Audit Log" })
        .locator("xpath=ancestor::section[1]");

      await expect(auditSection.getByRole("cell", { name: "Result correction answered", exact: true }).first()).toBeVisible();
      await expect(auditSection.getByRole("cell", { name: "Result", exact: true }).first()).toBeVisible();
      await expect(auditSection.locator("[data-audit-details]").first()).toContainText("Status: Fixed");
      await expect(auditSection.getByRole("checkbox", { name: "Result correction answered" })).toBeChecked();

      // Codes in words, typed text as typed (req_0002).
      await gotoWithRetry(page, `${appUrl}/admin/setup?tab=audit&actions=result.correction_level_raised`, {
        waitUntil: "domcontentloaded",
      });
      const levelDetails = auditSection.locator("[data-audit-details]").first();
      await expect(levelDetails).toContainText("From: Low");
      await expect(levelDetails).toContainText("To: High");
      await expect(levelDetails).toContainText("Reason: low turnout");

      // Every tab at three widths: no sideways scroll, nothing past the edge,
      // and no raw codes or long ids in the audit rows.
      for (const width of [1440, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });

        for (const tab of ["", "?tab=storage", "?tab=committee", "?tab=audit&actions=result.correction_answered"]) {
          await gotoWithRetry(page, `${appUrl}/admin/setup${tab}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

          const overflow = await page.evaluate(() => {
            const width = window.innerWidth;
            const clipped = (element: Element) => {
              for (let parent = element.parentElement; parent; parent = parent.parentElement) {
                const style = getComputedStyle(parent);

                if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
                  return true;
                }
              }

              return false;
            };
            const outside = [...document.body.querySelectorAll("*")]
              .filter((element) => {
                const rect = element.getBoundingClientRect();

                return rect.width > 0 && rect.height > 0 && rect.right > width + 1 && !clipped(element);
              })
              .slice(0, 5)
              .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`);

            return { scroll: document.documentElement.scrollWidth - width, outside };
          });

          expect(overflow, `${width}px ${tab || "juristic"}`).toEqual({ scroll: 0, outside: [] });
        }

        // The rows on screen (cards on phones, the table from md up).
        const rowsText = await page.evaluate(() => {
          const rows = [
            ...document.querySelectorAll("[data-audit-cards] li, #audit table tbody tr"),
          ].filter((element) => element.getClientRects().length > 0);

          return rows
            .map((row) => {
              const copy = row.cloneNode(true) as HTMLElement;

              copy.querySelectorAll("details").forEach((element) => element.remove());
              return copy.textContent ?? "";
            })
            .join("\n");
        });

        expect(rowsText).toContain("Result correction answered");
        expect(rowsText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        expect(rowsText).not.toMatch(/\b(result\.correction_answered|result_snapshot|request_id|meeting_id)\b/);
      }
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 });
      if (auditRow) {
        await supabase.from("audit_logs").delete().eq("id", auditRow.id);
      }
      if (levelRow) {
        await supabase.from("audit_logs").delete().eq("id", levelRow.id);
      }
    }
  });
});
