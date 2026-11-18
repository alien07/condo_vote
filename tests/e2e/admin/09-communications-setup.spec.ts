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
});
