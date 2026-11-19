import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  findUserByEmail,
  chooseSearchOption,
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
    const typedPosition = `Building liaison ${stamp}`;

    try {
      await page.goto(
        `${appUrl}/admin/setup?tab=committee&sort=name&dir=desc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add committee member" }).click();
      const addDrawer = page.getByRole("dialog", {
        name: "Add committee member",
      });

      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Committee name is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toBeFocused();

      // Positions are a fixed list in the page language (D026); "Other"
      // asks for the typed title.
      const positionSelect = addDrawer.getByRole("combobox", { exact: true, name: "Position" });

      await expect(positionSelect).toHaveValue("member");
      await expect(positionSelect.locator("option")).toHaveText([
        "Chairperson",
        "Vice chairperson",
        "Secretary",
        "Assistant secretary",
        "Treasurer",
        "Committee member",
        "Other (typed)",
      ]);
      await addDrawer.locator('input[name="full_name"]').fill(memberName);
      await positionSelect.selectOption("other");
      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Type the position title.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await expect(
        addDrawer.getByRole("textbox", { name: "Position title" }),
      ).toBeFocused();

      await addDrawer.getByRole("textbox", { name: "Position title" }).fill(typedPosition);
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
      await expect(memberRow.getByRole("cell", { name: typedPosition })).toBeVisible();
      await expect(memberRow.locator("[data-committee-status]")).toHaveText("Active");
      await expect(
        memberRow.getByRole("button", { name: "Deactivate" }),
      ).toBeVisible();
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-committee-id") === id,
        memberId,
      );

      await memberRow.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("dialog", {
        name: "Edit committee member",
      });

      await expect(editDrawer).toBeVisible({ timeout: 15_000 });
      await expect(editDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await expect(editDrawer.getByRole("textbox", { name: "Position title" })).toHaveValue(typedPosition);
      await editDrawer
        .getByRole("combobox", { exact: true, name: "Position" })
        .selectOption("vice_chair");
      await expect(editDrawer.getByRole("textbox", { name: "Position title" })).toHaveCount(0);
      await editDrawer
        .getByRole("button", { name: "Save committee member" })
        .click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("focusCommitteeId") === memberId &&
          !url.searchParams.has("mode"),
      );
      await expect(memberRow.getByRole("cell", { name: "Vice chairperson" })).toBeVisible();
      await expect(memberRow).toHaveClass(/border-l-\[var\(--primary\)\]/);

      // Phones get cards with the status and both buttons on screen
      // (setup review 2026-11-19); the table is for md and up.
      await page.setViewportSize({ width: 375, height: 800 });
      const memberCard = page.locator(`li[data-committee-id="${memberId}"]`);

      await expect(memberCard).toBeVisible();
      await expect(page.locator(`tr[data-committee-id="${memberId}"]`)).toBeHidden();
      await expect(memberCard).toContainText("Vice chairperson");
      await expect(memberCard.locator("[data-committee-status]")).toHaveText("Active");
      await memberCard.scrollIntoViewIfNeeded();
      for (const name of ["Edit", "Deactivate"]) {
        const control = memberCard.getByRole(name === "Edit" ? "link" : "button", { name });

        await expect(control).toBeInViewport({ ratio: 1 });
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(40);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 720 });

      await memberRow.getByRole("button", { name: "Deactivate" }).click();
      await confirmInApp(page);
      // Every action says what happened (2026-11-19).
      await expect(page.getByText("Committee member deactivated")).toBeVisible({ timeout: 15_000 });
      await expect(
        memberRow.getByRole("button", { name: "Reactivate" }),
      ).toBeVisible({ timeout: 15_000 });

      await memberRow.getByRole("button", { name: "Reactivate" }).click();
      await confirmInApp(page);
      await expect(page.getByText("Committee member reactivated")).toBeVisible({ timeout: 15_000 });
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
    const storagePath = `/private/storage-rollout-${stamp}.pdf`;
    const fileText = `condoVotes storage rollout ${stamp}`;
    const fileChecksum = createHash("sha256").update(fileText).digest("hex");
    let documentId: string | null = null;
    let secondId: string | null = null;

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
      await storageSection.getByRole("link", { name: "Go to documents" }).click();
      await expect(page).toHaveURL(/\/admin\/documents/);

      await page.goto(`${appUrl}/admin/documents?sort=created&dir=desc&perPage=25`);
      await page.getByRole("link", { name: "Register document" }).click();
      const drawer = page.getByRole("dialog", {
        name: "Register document",
      });

      // Every field has a label; whose document is picked, not typed as an id.
      for (const label of ["Document type", "Document of", "Storage"]) {
        await expect(drawer.getByRole("combobox", { name: label, exact: true })).toBeVisible();
      }
      await expect(drawer.getByRole("textbox", { name: "Folder path or private Drive link", exact: true })).toBeVisible();
      await expect(drawer.locator('input[name="owner_id"]')).toHaveCount(0);
      await expect(drawer.getByRole("option", { name: "owner_verification" })).toHaveCount(0);

      await drawer.getByRole("button", { name: "Register document" }).click();
      await expect(drawer.getByText("Choose whose document it is.")).toBeVisible();
      await expect(drawer.getByText("Path or link is required.")).toBeVisible();
      await expect(drawer.locator('[data-focus-for="owner_id_profile"]')).toBeFocused();

      // Pick the person by email (SearchSelect submits the profile id).
      await chooseSearchOption(drawer, "owner_id_profile", demoAdminEmail);
      await expect(drawer.locator('input[type="hidden"][name="owner_id_profile"]')).toHaveValue(profile!.id);
      await drawer.getByRole("textbox", { name: "Folder path or private Drive link", exact: true }).fill(storagePath);

      // Check data: read a local file in the browser; nothing is uploaded.
      await drawer.getByText("Check data (optional)").click();
      await drawer.locator("[data-file-calculator]").setInputFiles({
        name: "proxy-form.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(fileText),
      });
      await expect(drawer.locator('input[name="checksum_sha256"]')).toHaveValue(fileChecksum);
      await expect(drawer.locator('input[name="original_filename"]')).toHaveValue("proxy-form.pdf");
      await expect(drawer.locator('input[name="mime_type"]')).toHaveValue("application/pdf");
      await expect(drawer.locator('input[name="file_size_bytes"]')).toHaveValue(String(Buffer.byteLength(fileText)));
      await expect(drawer.locator('[data-file-calculator]')).not.toHaveAttribute("name", /.+/);

      await drawer.getByRole("button", { name: "Register document" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusDocumentId")));

      documentId = new URL(page.url()).searchParams.get("focusDocumentId");
      expect(documentId).toBeTruthy();
      await expect(page).toHaveURL(/sort=created/);
      await expect(page).toHaveURL(/perPage=25/);

      const documentRow = page.locator(`tr[data-document-id="${documentId}"]:visible`);

      await expect(documentRow).toBeVisible();
      await expect(documentRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(documentRow).toContainText(demoAdminName);
      await expect(documentRow).toContainText("Owner verification");
      await expect(documentRow).toContainText(`${fileChecksum.slice(0, 4)}…${fileChecksum.slice(-4)}`);
      await expect(documentRow).not.toContainText("owner_verification");
      await expect(documentRow).not.toContainText("local_drive");
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-document-id") === id,
        documentId,
      );

      // View details: full path and checksum, who registered it.
      await documentRow.getByRole("link", { name: "View details" }).click();
      const details = page.getByRole("dialog", { name: "Document details" });

      await expect(details.locator("[data-full-checksum]")).toHaveText(fileChecksum);
      await expect(details).toContainText(storagePath);
      await expect(details).toContainText(demoAdminName);

      // Register new version: same person and set, next version.
      await details.getByRole("link", { name: "Register new version" }).click();
      const versionDrawer = page.getByRole("dialog", { name: "Register new version" });

      await expect(versionDrawer.locator('input[type="hidden"][name="owner_id_profile"]')).toHaveValue(profile!.id);
      await versionDrawer
        .getByRole("textbox", { name: "Folder path or private Drive link", exact: true })
        .fill(storagePath.replace(".pdf", "-v2.pdf"));
      await versionDrawer.getByRole("button", { name: "Register new version" }).click();
      await page.waitForURL((url) => {
        const focused = url.searchParams.get("focusDocumentId");

        return Boolean(focused) && focused !== documentId;
      });
      secondId = new URL(page.url()).searchParams.get("focusDocumentId");
      const secondRow = page.locator(`tr[data-document-id="${secondId}"]:visible`);

      await expect(secondRow).toContainText("v2");

      // Phones: cards, nothing past the edge.
      await page.setViewportSize({ width: 375, height: 800 });
      await expect(page.locator(`li[data-document-id="${secondId}"]`)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 720 });
    } finally {
      for (const id of [documentId, secondId]) {
        if (id) {
          await supabase.from("audit_logs").delete().eq("entity_id", id);
          await supabase.from("documents").delete().eq("id", id);
        }
      }
    }
  });
  test("documents page and drawers: words, no ids, no overflow at 1440, 768 and 375 px", async ({ page }) => {
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
    await supabase
      .from("app_roles")
      .upsert({ profile_id: profile!.id, role: "admin" }, { onConflict: "profile_id,role" });

    const stamp = Date.now();
    const { data: seeded, error: seedError } = await supabase
      .from("documents")
      .insert({
        owner_type: "profile",
        owner_id: profile!.id,
        document_type: "owner_verification",
        storage_provider: "local_drive",
        storage_path: `/private/layout-check/a-rather-long-folder-name-for-the-layout-check-${stamp}.pdf`,
        document_set_key: `profile:${profile!.id}:layout-${stamp}`,
        document_version: 1,
        checksum_sha256: "a".repeat(64),
        visibility: "private",
        uploaded_by: profile!.id,
      })
      .select("id")
      .single();

    expect(seedError).toBeNull();

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

    try {
      for (const width of [1440, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });

        for (const query of ["", "&mode=create", `&mode=view&id=${seeded!.id}`]) {
          await page.goto(`${appUrl}/admin/documents?sort=created&dir=desc&perPage=25${query}`, {
            waitUntil: "domcontentloaded",
          });
          await expect(page.locator(`[data-document-id="${seeded!.id}"]:visible`)).toBeVisible();

          const check = await page.evaluate(() => {
            const width = window.innerWidth;
            const clipped = (element: Element) => {
              for (let parent = element.parentElement; parent; parent = parent.parentElement) {
                if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX)) {
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

            return {
              scroll: document.documentElement.scrollWidth - width,
              outside,
              text: document.body.innerText,
            };
          });
          const where = `${width}px ${query || "list"}`;

          expect({ scroll: check.scroll, outside: check.outside }, where).toEqual({ scroll: 0, outside: [] });
          expect(check.text, where).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          expect(check.text, where).not.toMatch(
            /\b(owner_verification|proxy_authorization|meeting_attachment|result_pdf|local_drive|google_drive|result_snapshot)\b/,
          );
        }
      }
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 });
      await supabase.from("documents").delete().eq("id", seeded!.id);
    }
  });
});
