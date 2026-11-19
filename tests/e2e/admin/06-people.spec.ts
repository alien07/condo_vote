import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: people", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("people CRUD pilot uses drawer actions and validation", async ({
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
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
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
        type: "magiclink",
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    const pilotRoomNumber = `PILOT-${Date.now()}`;
    await page.goto(`${appUrl}/admin/people`);
    await expect(page).toHaveURL(/tab=rooms|\/admin\/people$/);
    await expect(
      page.getByRole("heading", { name: "Rooms", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add room" }).click();
    const addRoomDrawer = page.getByRole("dialog", { name: "Add room" });
    await expect(addRoomDrawer).toBeVisible();
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(
      addRoomDrawer.getByText("Please fix 2 fields before saving."),
    ).toBeVisible();
    await expect(addRoomDrawer.getByText("Room number is required.")).toBeVisible();
    await expect(addRoomDrawer.locator('input[name="room_number"]')).toBeFocused();
    await addRoomDrawer.locator('input[name="room_number"]').fill(pilotRoomNumber);
    await addRoomDrawer.locator('input[name="ownership_percent"]').fill("101");
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(
      addRoomDrawer.getByText("Ownership percentage must be between 0 and 100."),
    ).toBeVisible();
    await expect(addRoomDrawer.locator('input[name="room_number"]')).toHaveValue(
      pilotRoomNumber,
    );
    await expect(
      addRoomDrawer.locator('input[name="ownership_percent"]'),
    ).toHaveValue("101");
    await expect(
      addRoomDrawer.locator('input[name="ownership_percent"]'),
    ).toBeFocused();
    await addRoomDrawer.locator('input[name="ownership_percent"]').fill("1.5");
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await page.waitForURL("**/admin/people?tab=rooms&feedback=success**", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("cell", { name: pilotRoomNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const pilotRoomRow = page.getByRole("row").filter({ hasText: pilotRoomNumber });
    await pilotRoomRow.getByRole("link", { name: "Edit" }).click();
    const editRoomDrawer = page.getByRole("dialog", { name: "Edit room" });
    await expect(editRoomDrawer.getByText(`Room: ${pilotRoomNumber}`)).toBeVisible();
    await expect(pilotRoomRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
    await editRoomDrawer.getByRole("link", { name: "Cancel" }).click();
    await expect(editRoomDrawer).toHaveCount(0);
    await expect(page).toHaveURL(/tab=rooms/);

    await page.goto(`${appUrl}/admin/people?tab=profiles`);
    const profileRow = page.getByRole("row").filter({ hasText: demoAdminEmail });
    await profileRow.getByRole("link", { name: "Edit roles/status" }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit roles/status" }),
    ).toBeVisible();
    await page.getByLabel("Close drawer").click();
    await expect(page).toHaveURL(/tab=profiles/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appUrl}/admin/people?tab=owners`);
    await expect(
      page.getByRole("heading", { exact: true, name: "Owners" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add owner" }).click();
    const addOwnerMobileDrawer = page.getByRole("dialog", {
      name: "Add owner",
    });
    await expect(addOwnerMobileDrawer).toBeVisible();
    const drawerWidth = await addOwnerMobileDrawer.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    const viewportWidth = page.viewportSize()?.width ?? 390;
    expect(drawerWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test("accounts waiting for approval: overview card opens the Users tab with only pending accounts (req_0004)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

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
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase
      .from("app_roles")
      .upsert([{ profile_id: profile!.id, role: "admin" }], { onConflict: "profile_id,role" });

    expect(roleError).toBeNull();

    // Synthetic accounts: 11 waiting (more than one page of 10) and 1 approved.
    const stamp = Date.now();
    const { data: added, error: addError } = await supabase
      .from("profiles")
      .insert([
        ...Array.from({ length: 11 }, (_, index) => ({
          approval_status: "pending",
          default_status: "resident",
          email: `pending-${stamp}-${index}@example.test`,
          full_name: `Pending ${stamp} ${String(index).padStart(2, "0")}`,
        })),
        {
          approval_status: "approved",
          default_status: "resident",
          email: `approved-${stamp}@example.test`,
          full_name: `Approved ${stamp}`,
        },
      ])
      .select("id");

    expect(addError).toBeNull();

    try {
      const { count: pendingCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending");
      const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

      expect(linkError).toBeNull();
      await page.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
          link.properties!.hashed_token,
        )}&type=${link.properties!.verification_type}`,
      );

      // Overview: the card shows how many wait, and one click opens the list.
      await page.goto(`${appUrl}/admin`);
      const card = page.getByRole("link", { name: /Accounts waiting for approval/ });

      await expect(card).toContainText(String(pendingCount));
      await expect(card).toContainText("Needs review");
      await card.click();
      await expect(page).toHaveURL(/\/admin\/people\?[\s\S]*tab=profiles/);
      await expect(page).toHaveURL(/[?&]approval=pending/);

      const badges = page.locator("[data-approval]:visible");

      await expect(badges.first()).toBeVisible();
      await expect(page.locator('[data-approval]:visible:not([data-approval="pending"])')).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Remove filter.*Approval status: Pending/ })).toBeVisible();

      // The filter survives paging.
      // The Rooms and Owners tabs are on the page too, hidden: use the visible pager.
      await page.locator('select[aria-label="Per page"]:visible').first().selectOption("10");
      await expect(page).toHaveURL(/[?&]approval=pending/);
      await expect(badges).toHaveCount(10);
      await page.locator('select[aria-label="Page"]:visible').first().selectOption("2");
      await expect(page).toHaveURL(/[?&]page=2/);
      await expect(page).toHaveURL(/[?&]approval=pending/);
      await expect(page.locator('[data-approval]:visible:not([data-approval="pending"])')).toHaveCount(0);

      // The filter on its own, from the Users tab.
      await page.goto(`${appUrl}/admin/people?tab=profiles`);
      await page.getByRole("combobox", { name: "Approval status" }).selectOption("approved");
      await page.locator('button:visible', { hasText: /^Search$/ }).first().click();
      await expect(page).toHaveURL(/[?&]approval=approved/);
      await expect(badges.first()).toBeVisible();
      await expect(page.locator('[data-approval]:visible:not([data-approval="approved"])')).toHaveCount(0);
    } finally {
      const ids = (added ?? []).map((row) => row.id);

      if (ids.length) {
        await supabase.from("profiles").delete().in("id", ids);
      }
    }
  });
});
