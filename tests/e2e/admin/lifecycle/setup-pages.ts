// Admin lifecycle step: Setup: juristic person, storage documents, audit log, committee.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AfterAccess } from "./access";
import { chooseSearchOption, demoAdminEmail } from "../admin-helpers";

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
  // Every field has a visible label (setup review 2026-11-19).
  for (const label of ["Tax ID", "Phone", "Email", "Address", "Document footer"]) {
    await expect(juristicSection.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(juristicSection.getByLabel("Phone", { exact: true })).toHaveAttribute("type", "tel");
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
  await storageSection.getByRole("link", { name: "Go to documents" }).click();
  await page.getByRole("link", { name: "Register document" }).click();
  const registerDocumentDrawer = page.getByRole("dialog", {
    name: "Register document",
  });
  // Whose document: picked by email, submitted as the profile id (rule 8).
  await chooseSearchOption(registerDocumentDrawer, "owner_id_profile", demoAdminEmail);
  await expect(
    registerDocumentDrawer.locator('input[type="hidden"][name="owner_id_profile"]'),
  ).toHaveValue(profile!.id);
  await registerDocumentDrawer
    .getByLabel("Folder path or private Drive link", { exact: true })
    .fill(documentPath);
  await registerDocumentDrawer.getByText("Check data (optional)").click();
  await registerDocumentDrawer.locator('input[name="original_filename"]').fill(`${documentSetKey}.pdf`);
  await registerDocumentDrawer.locator('input[name="mime_type"]').fill("application/pdf");
  await registerDocumentDrawer.locator('input[name="file_size_bytes"]').fill("123");
  await registerDocumentDrawer
    .locator('input[name="checksum_sha256"]')
    .fill("a".repeat(64));
  await registerDocumentDrawer.getByRole("button", { name: "Register document" }).click();
  await page.waitForURL((url) => Boolean(url.searchParams.get("focusDocumentId")));
  const registeredRow = page.locator(
    `tr[data-document-id="${new URL(page.url()).searchParams.get("focusDocumentId")}"]:visible`,
  );
  await expect(registeredRow).toContainText("Owner verification");
  await expect(registeredRow).toContainText("aaaa…aaaa");
  await expect(registeredRow.getByText(documentPath)).toBeVisible();

  await page.goto(`${activeAppOrigin}/admin/setup?tab=audit`);
  const auditSection = page
    .getByRole("heading", { name: "Business Audit Log" })
    .locator("xpath=ancestor::section[1]");
  await expect(
    auditSection.getByRole("cell", { name: "Document registered", exact: true }).first(),
  ).toBeVisible();

  await page.goto(`${activeAppOrigin}/admin/setup?tab=committee`);
  const committeeSection = page
    .getByRole("heading", { name: "Committee Members" })
    .locator("xpath=ancestor::section[1]");
  await committeeSection.getByRole("link", { name: "Add committee member" }).click();
  const addCommitteeDrawer = page.getByLabel("Add committee member");
  await addCommitteeDrawer.locator('input[name="full_name"]').fill(committeeName);
  // The chair is the default chairperson of a new meeting (D026).
  await addCommitteeDrawer.locator('select[name="position_code"]').selectOption("chair");
  await addCommitteeDrawer.getByRole("button", { name: "Add committee member" }).click();
  await page.waitForURL(/\/admin\/setup\?[\s\S]*memberName=/, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("cell", { name: committeeName }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterSetupPages = AfterAccess;
