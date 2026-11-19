// Admin lifecycle step: Vote page cards and admin access (profiles, roles).
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { demoAdminEmail } from "../admin-helpers";
import type { AfterFixtures } from "./setup";

export async function access(page: Page, ctx: AfterFixtures) {
  const { futureMeetingTitle, closedMeetingTitle, activeAppOrigin } = ctx;

  await page.goto(
    `${activeAppOrigin}/vote/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000`,
  );
  await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  await page.goto(`${activeAppOrigin}/vote`);
  const futureVoteAssignment = page
    .getByRole("heading", { name: futureMeetingTitle })
    .locator("xpath=ancestor::section[1]");
  await expect(futureVoteAssignment.getByText("Not open yet")).toBeVisible();

  await page.goto(`${activeAppOrigin}/vote`);
  const closedVoteAssignment = page
    .getByRole("heading", { name: closedMeetingTitle })
    .locator("xpath=ancestor::section[1]");
  await expect(
    closedVoteAssignment.locator("span").filter({ hasText: "Closed" }),
  ).toBeVisible();

  // Overview (req_0008): waiting work, meetings now, readiness, master data.
  await page.goto(`${activeAppOrigin}/admin`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Overview", exact: true }),
  ).toBeVisible();
  for (const heading of ["Waiting for you", "Meetings now", "Readiness", "Master data"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Rooms that voted twice/ })).toHaveAttribute(
    "href",
    "/admin/voting/conflicts?status=unresolved",
  );
  await expect(page.getByRole("link", { name: /Emails in the queue/ })).toHaveAttribute(
    "href",
    "/admin/communications",
  );
  await page.goto(`${activeAppOrigin}/admin/people?tab=profiles`);
  await expect(
    page.getByRole("heading", { name: "Rooms & Owners", exact: true }),
  ).toBeVisible();
  const demoAdminRow = page
    .getByRole("row")
    .filter({ hasText: demoAdminEmail });
  await expect(
    demoAdminRow.getByRole("cell", { name: "owner", exact: true }),
  ).toBeVisible();
  // Approval status is a badge in words (req_0004).
  await expect(
    demoAdminRow.getByRole("cell", { name: "Approved", exact: true }),
  ).toBeVisible();
  await demoAdminRow.getByRole("link", { name: "Edit roles/status" }).click();
  const profileAccessDrawer = page.getByRole("dialog", {
    name: "Edit roles/status",
  });
  await profileAccessDrawer.locator('select[name="role"]').selectOption("committee");
  await profileAccessDrawer.getByRole("button", { name: "Save changes" }).click();
  // Wait for the save to finish before navigating away.
  await page.waitForURL(/\/admin\/people\?[\s\S]*feedback=success/, {
    waitUntil: "domcontentloaded",
  });
  await page.goto(`${activeAppOrigin}/admin/people?tab=profiles`);
  const roleDemoAdminRow = page
    .getByRole("row")
    .filter({ hasText: demoAdminEmail });
  await expect(
    roleDemoAdminRow.locator("td").nth(4).getByText("committee"),
  ).toBeVisible();
}

export type AfterAccess = AfterFixtures;
