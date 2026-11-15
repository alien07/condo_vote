// Admin lifecycle step: Proxy authorization: add and review.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { confirmInApp } from "../../confirm-dialog";
import { demoAdminEmail, demoAdminName, gotoWithRetry } from "../admin-helpers";
import type { AfterPeople } from "./people";

export async function proxies(page: Page, ctx: AfterPeople) {
  const { roomNumber, ownerName, meetingTitle, activeAppOrigin } = ctx;

  await gotoWithRetry(page, `${activeAppOrigin}/admin/proxies`, {
    waitUntil: "commit",
  });
  await page.getByRole("link", { name: "Add proxy authorization" }).click();
  const addProxyDrawer = page.getByLabel("Add proxy authorization");
  await addProxyDrawer
    .locator('select[name="meeting_id"]')
    .selectOption({ label: meetingTitle });
  await addProxyDrawer.locator('select[name="room_id"]').selectOption({
    label: roomNumber,
  });
  await addProxyDrawer
    .locator('select[name="owner_id"]')
    .selectOption({ label: ownerName });
  await addProxyDrawer
    .locator('select[name="proxy_profile_id"]')
    .selectOption({ label: `${demoAdminName} (${demoAdminEmail})` });
  await addProxyDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
  await page.waitForTimeout(1_000);
  await gotoWithRetry(
    page,
    `${activeAppOrigin}/admin/proxies?meeting=${encodeURIComponent(meetingTitle)}`,
    { waitUntil: "commit" },
  );
  const proxyRow = page.getByRole("row").filter({ hasText: meetingTitle });
  await expect(
    proxyRow.getByRole("cell", { name: "pending", exact: true }),
  ).toBeVisible();
  const proxyReviewHref = await proxyRow
    .getByRole("link", { name: "Review" })
    .getAttribute("href");
  expect(proxyReviewHref).toBeTruthy();
  await gotoWithRetry(page, new URL(proxyReviewHref ?? "", activeAppOrigin).toString(), {
    waitUntil: "commit",
  });
  const reviewProxyDrawer = page.getByRole("complementary", {
    name: "Review proxy authorization",
  });
  await expect(reviewProxyDrawer).toBeVisible({ timeout: 15_000 });
  await reviewProxyDrawer.locator('select[name="status"]').selectOption("approved");
  await reviewProxyDrawer.getByRole("button", { name: "Save review" }).click();
  await confirmInApp(page);
  await page.waitForTimeout(1_000);
  await gotoWithRetry(
    page,
    `${activeAppOrigin}/admin/proxies?meeting=${encodeURIComponent(meetingTitle)}`,
    { waitUntil: "commit" },
  );
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .getByRole("cell", { name: "approved", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterProxies = AfterPeople;
