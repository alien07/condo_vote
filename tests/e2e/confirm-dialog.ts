import { expect, type Page } from "@playwright/test";

/** Accepts the app's confirm dialog (ConfirmSubmitButton). */
export async function confirmInApp(page: Page, expectedText?: string) {
  const dialog = page.getByRole("alertdialog");

  await expect(dialog).toBeVisible();

  if (expectedText) {
    await expect(dialog).toContainText(expectedText);
  }

  await dialog.getByRole("button", { name: /^(Confirm|ยืนยัน)$/ }).click();
}
