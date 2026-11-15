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

test.describe("@test:e2e @test:auth @test:admin admin demo: people import", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("people import rollout validates missing Excel files", async ({
    page,
  }) => {
    test.setTimeout(90_000);

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

    await gotoWithRetry(page, `${appUrl}/admin/people/import`, {
      waitUntil: "commit",
    });

    await expect(
      page.getByRole("heading", { name: "Excel Import Master Data" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download rooms template" }),
    ).toHaveAttribute("href", "/templates/rooms-import-template.xlsx");
    await expect(
      page.getByRole("link", { name: "Download owners template" }),
    ).toHaveAttribute("href", "/templates/owners-import-template.xlsx");
    await expect(
      page.getByRole("link", { name: "Download room owners template" }),
    ).toHaveAttribute("href", "/templates/room-owners-import-template.xlsx");

    const roomsImportCard = page
      .getByRole("heading", { name: "Import rooms" })
      .locator("xpath=ancestor::form[1]");

    await roomsImportCard
      .getByRole("button", { name: "Upload rooms Excel" })
      .click();
    await expect(
      roomsImportCard.getByText("Please choose an Excel file before uploading."),
    ).toBeVisible();
    await expect(roomsImportCard.locator('input[name="file"]')).toBeFocused();
  });
});
