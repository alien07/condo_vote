// Admin lifecycle step: Setup: juristic person, storage documents, audit log, committee.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AfterAccess } from "./access";

export async function setupPages(page: Page, ctx: AfterAccess) {
  const { committeeName, documentSetKey, documentPath, profile, activeAppOrigin } = ctx;

  await page.goto(`${activeAppOrigin}/admin/setup`);
  const juristicSection = page
    .getByRole("heading", { name: "Juristic Person" })
    .locator("xpath=ancestor::section[1]");
  await juristicSection
    .getByRole("textbox", { exact: true, name: "Juristic person name" })
    .fill("Demo Juristic Person");
  await juristicSection
    .getByRole("textbox", { exact: true, name: "Project name" })
    .fill("Demo Condo");
  await juristicSection
    .getByRole("textbox", { name: "Registration no." })
    .fill("REG-001");
  await juristicSection
    .getByRole("textbox", { name: "Juristic manager" })
    .fill("Demo Manager");
  await juristicSection
    .getByRole("button", { name: "Save juristic profile" })
    .click();
  await expect(juristicSection.locator('input[name="juristic_name"]')).toHaveValue(
    "Demo Juristic Person",
  );

  await page.goto(`${activeAppOrigin}/admin/setup?tab=storage`);
  const storageSection = page
    .getByRole("heading", { name: "Document Storage" })
    .locator("xpath=ancestor::section[1]");
  await storageSection
    .locator('select[name="document_storage_provider"]')
    .selectOption("local_drive");
  await storageSection
    .locator('input[name="document_storage_root"]')
    .fill("/private/condovotes-demo");
  await storageSection
    .getByRole("button", { name: "Save document storage config" })
    .click();
  await storageSection.getByRole("link", { name: "Open Documents" }).click();
  await page.getByRole("link", { name: "Register document" }).click();
  const registerDocumentDrawer = page.getByRole("dialog", {
    name: "Register document",
  });
  await registerDocumentDrawer.locator('input[name="owner_id"]').fill(profile!.id);
  await registerDocumentDrawer
    .locator('input[name="storage_path"]')
    .fill(documentPath);
  await registerDocumentDrawer
    .locator('input[name="document_set_key"]')
    .fill(documentSetKey);
  await registerDocumentDrawer
    .locator('input[name="original_filename"]')
    .fill(`${documentSetKey}.pdf`);
  await registerDocumentDrawer
    .locator('input[name="mime_type"]')
    .fill("application/pdf");
  await registerDocumentDrawer.locator('input[name="file_size_bytes"]').fill("123");
  await registerDocumentDrawer
    .locator('input[name="checksum_sha256"]')
    .fill("a".repeat(64));
  await registerDocumentDrawer.getByRole("button", { name: "Register document" }).click();
  await expect(
    page.getByRole("cell", { name: `${documentSetKey} / v1` }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: documentPath }),
  ).toBeVisible();

  await page.goto(`${activeAppOrigin}/admin/setup?tab=audit`);
  const auditSection = page
    .getByRole("heading", { name: "Business Audit Log" })
    .locator("xpath=ancestor::section[1]");
  await expect(
    auditSection.getByRole("cell", { name: "document.registered" }).first(),
  ).toBeVisible();

  await page.goto(`${activeAppOrigin}/admin/setup?tab=committee`);
  const committeeSection = page
    .getByRole("heading", { name: "Committee Members" })
    .locator("xpath=ancestor::section[1]");
  await committeeSection.getByRole("link", { name: "Add committee member" }).click();
  const addCommitteeDrawer = page.getByLabel("Add committee member");
  await addCommitteeDrawer.locator('input[name="full_name"]').fill(committeeName);
  await addCommitteeDrawer.locator('input[name="position_title"]').fill("Chairperson");
  await addCommitteeDrawer.getByRole("button", { name: "Add committee member" }).click();
  await page.waitForURL(/\/admin\/setup\?[\s\S]*memberName=/, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("cell", { name: committeeName }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterSetupPages = AfterAccess;
