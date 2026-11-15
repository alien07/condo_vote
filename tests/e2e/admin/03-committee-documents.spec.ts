import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
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

test.describe("@test:e2e @test:auth @test:admin admin demo: committee and documents", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("committee CRUD rollout preserves state and supports status actions", async ({
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
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();
    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
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

    const stamp = Date.now();
    const memberName = `Committee rollout ${stamp}`;
    const updatedPosition = `Vice chair ${stamp}`;

    try {
      await page.goto(
        `${appUrl}/admin/setup?tab=committee&sort=name&dir=desc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add committee member" }).click();
      const addDrawer = page.getByRole("complementary", {
        name: "Add committee member",
      });

      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Committee name is required.")).toBeVisible();
      await expect(addDrawer.getByText("Position is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toBeFocused();

      await addDrawer.locator('input[name="full_name"]').fill(memberName);
      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Position is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await expect(
        addDrawer.locator('input[name="position_title"]'),
      ).toBeFocused();

      await addDrawer.locator('input[name="position_title"]').fill("Chairperson");
      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusCommitteeId")));

      const memberId = new URL(page.url()).searchParams.get("focusCommitteeId");

      expect(memberId).toBeTruthy();
      await expect(page).toHaveURL(/sort=name/);
      await expect(page).toHaveURL(/dir=desc/);
      await expect(page).toHaveURL(/perPage=25/);

      const memberRow = page.locator(
        `tr[data-committee-id="${memberId}"]:visible`,
      );

      await expect(memberRow).toBeVisible();
      await expect(memberRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(
        memberRow.getByRole("button", { name: "Deactivate" }),
      ).toBeVisible();
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-committee-id") === id,
        memberId,
      );

      await memberRow.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("complementary", {
        name: "Edit committee member",
      });

      await expect(editDrawer).toBeVisible({ timeout: 15_000 });
      await expect(editDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await editDrawer
        .locator('input[name="position_title"]')
        .fill(updatedPosition);
      await editDrawer
        .getByRole("button", { name: "Save committee member" })
        .click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("focusCommitteeId") === memberId &&
          !url.searchParams.has("mode"),
      );
      await expect(memberRow.getByRole("cell", { name: updatedPosition })).toBeVisible();
      await expect(memberRow).toHaveClass(/border-l-\[var\(--primary\)\]/);

      await memberRow.getByRole("button", { name: "Deactivate" }).click();
      await confirmInApp(page);
      await expect(
        memberRow.getByRole("button", { name: "Reactivate" }),
      ).toBeVisible({ timeout: 15_000 });

      await memberRow.getByRole("button", { name: "Reactivate" }).click();
      await confirmInApp(page);
      await expect(
        memberRow.getByRole("button", { name: "Deactivate" }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await supabase.from("committee_members").delete().eq("full_name", memberName);
    }
  });

  test("storage document rollout validates and focuses registered documents", async ({
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
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();
    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
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

    const stamp = Date.now();
    const documentSet = `storage-rollout-${stamp}`;
    const storagePath = `/private/storage-rollout-${stamp}.pdf`;
    let documentId: string | null = null;

    try {
      await page.goto(`${appUrl}/admin/setup?tab=storage`);
      const storageSection = page
        .getByRole("heading", { name: "Document Storage" })
        .locator("xpath=ancestor::section[1]");

      await expect(
        storageSection.getByRole("button", {
          name: "Save document storage config",
        }),
      ).toBeVisible();
      await storageSection.getByRole("link", { name: "Open Documents" }).click();
      await expect(page).toHaveURL(/\/admin\/documents/);

      await page.goto(
        `${appUrl}/admin/documents?sort=set&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Register document" }).click();
      const drawer = page.getByRole("complementary", {
        name: "Register document",
      });

      await drawer.getByRole("button", { name: "Register document" }).click();
      await expect(drawer.getByText("Owner UUID is required.")).toBeVisible();
      await expect(drawer.getByText("Path or link is required.")).toBeVisible();
      await expect(drawer.getByText("Document set key is required.")).toBeVisible();
      await expect(drawer.locator('input[name="owner_id"]')).toBeFocused();

      await drawer.locator('input[name="owner_id"]').fill("invalid-owner-id");
      await drawer.locator('input[name="storage_path"]').fill(storagePath);
      await drawer.locator('input[name="document_set_key"]').fill(documentSet);
      await drawer.getByRole("button", { name: "Register document" }).click();
      await expect(drawer.getByText("Owner UUID must be a valid UUID.")).toBeVisible();
      await expect(drawer.locator('input[name="storage_path"]')).toHaveValue(
        storagePath,
      );
      await expect(drawer.locator('input[name="document_set_key"]')).toHaveValue(
        documentSet,
      );
      await expect(drawer.locator('input[name="owner_id"]')).toBeFocused();

      await drawer.locator('input[name="owner_id"]').fill(profile!.id);
      await drawer.getByRole("button", { name: "Register document" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusDocumentId")));

      documentId = new URL(page.url()).searchParams.get("focusDocumentId");
      expect(documentId).toBeTruthy();
      await expect(page).toHaveURL(/sort=set/);
      await expect(page).toHaveURL(/dir=asc/);
      await expect(page).toHaveURL(/perPage=25/);
      await expect(page).toHaveURL(new RegExp(`set=${documentSet}`));

      const documentRow = page.locator(
        `tr[data-document-id="${documentId}"]:visible`,
      );

      await expect(documentRow).toBeVisible();
      await expect(documentRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(documentRow).toContainText(documentSet);
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-document-id") === id,
        documentId,
      );
    } finally {
      if (documentId) {
        await supabase.from("audit_logs").delete().eq("entity_id", documentId);
        await supabase.from("documents").delete().eq("id", documentId);
      } else {
        await supabase.from("documents").delete().eq("document_set_key", documentSet);
      }
    }
  });
});
