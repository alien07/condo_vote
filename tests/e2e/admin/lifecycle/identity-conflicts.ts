// Admin lifecycle step: Paper ballot identity and vote-source conflicts.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { confirmInApp } from "../../confirm-dialog";
import { chooseSearchOption, demoAdminEmail } from "../admin-helpers";
import type { AfterVoting } from "./voting";

export async function identityConflicts(page: Page, ctx: AfterVoting) {
  const { roomNumber, meetingTitle, activeAppOrigin } = ctx;

  await page.goto(
    `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
  );
  const pendingMeetingRow = page
    .getByRole("row")
    .filter({ hasText: meetingTitle });
  await expect(
    pendingMeetingRow.getByRole("link", { name: /Resolve 1 pending manual vote/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    pendingMeetingRow.getByRole("button", { name: "Generate result" }),
  ).toHaveCount(0);

  await page.goto(`${activeAppOrigin}/admin/voting`);
  const pendingManualVoteRow = page
    .getByRole("row")
    .filter({ hasText: meetingTitle })
    .filter({ hasText: roomNumber });
  await pendingManualVoteRow.getByRole("link", { name: "Link profile" }).click();
  const resolveIdentityDrawer = page.getByRole("complementary", {
    name: "Resolve manual vote identity",
  });
  await expect(resolveIdentityDrawer).toBeVisible({ timeout: 15_000 });
  await chooseSearchOption(resolveIdentityDrawer, "voter_profile_id", demoAdminEmail);
  await resolveIdentityDrawer.getByRole("button", { name: "Link profile" }).click();
  await confirmInApp(page);
  await page.waitForURL(/\/admin\/voting\?[\s\S]*feedback=success/, {
    waitUntil: "domcontentloaded",
  });

  await page.goto(
    `${activeAppOrigin}/admin/voting/conflicts?meeting=${encodeURIComponent(
      meetingTitle,
    )}&room=${encodeURIComponent(roomNumber)}`,
  );
  const conflictRow = page
    .getByRole("row")
    .filter({ hasText: meetingTitle })
    .filter({ hasText: roomNumber });
  await conflictRow.getByRole("button", { name: "Review / Resolve" }).click();
  const reviewConflictDialog = page.getByRole("dialog", {
    name: "Review vote source conflict",
  });
  await reviewConflictDialog
    .locator('select[name="chosen_source"]')
    .selectOption("online");
  await reviewConflictDialog
    .getByPlaceholder("Explain why this source is selected.")
    .fill("Use online demo vote");
  await reviewConflictDialog.getByRole("button", { name: "Resolve source" }).click();
  await expect(reviewConflictDialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Conflict resolved.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: roomNumber })
      .getByRole("cell", { name: "resolved", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterIdentityConflicts = AfterVoting;
