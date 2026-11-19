// Admin lifecycle step: Proxy authorization: add and review.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { confirmInApp } from "../../confirm-dialog";
import { chooseSearchOption, gotoWithRetry } from "../admin-helpers";
import type { AfterPeople } from "./people";

export async function proxies(page: Page, ctx: AfterPeople) {
  const { roomNumber, ownerName, meetingTitle, activeAppOrigin, proxyHolder } = ctx;

  await gotoWithRetry(page, `${activeAppOrigin}/admin/proxies`, {
    waitUntil: "commit",
  });
  await page.getByRole("link", { name: "Add proxy authorization" }).click();
  const addProxyDrawer = page.getByLabel("Add proxy authorization");
  await chooseSearchOption(addProxyDrawer, "meeting_id", meetingTitle);
  await chooseSearchOption(addProxyDrawer, "room_id", roomNumber);
  await chooseSearchOption(addProxyDrawer, "owner_id", ownerName);
  await chooseSearchOption(addProxyDrawer, "proxy_profile_id", proxyHolder.email);
  await addProxyDrawer.getByLabel(/not a committee member, the manager/).check();
  await addProxyDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
  await page.waitForTimeout(1_000);
  // Meeting and room filters: type to search, pick, search. The URL then
  // carries the ids, not the title or room number (2026-11-19).
  await gotoWithRetry(page, `${activeAppOrigin}/admin/proxies`, { waitUntil: "load" });
  const proxyFilter = page.locator("form").filter({ has: page.locator('[data-focus-for="meeting"]') });
  await chooseSearchOption(proxyFilter, "meeting", meetingTitle);
  await chooseSearchOption(proxyFilter, "room", roomNumber);
  await proxyFilter.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/[?&]meeting=[0-9a-f-]{36}[\s\S]*[?&]room=[0-9a-f-]{36}/, { waitUntil: "commit" });
  const proxiesUrl = page.url();
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
  const reviewProxyDrawer = page.getByRole("dialog", {
    name: "Review proxy authorization",
  });
  await expect(reviewProxyDrawer).toBeVisible({ timeout: 15_000 });
  await reviewProxyDrawer.locator('select[name="status"]').selectOption("approved");
  await reviewProxyDrawer.getByRole("button", { name: "Save review" }).click();
  await confirmInApp(page);
  await page.waitForTimeout(1_000);
  await gotoWithRetry(page, proxiesUrl, { waitUntil: "commit" });
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .getByRole("cell", { name: "approved", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterProxies = AfterPeople;
