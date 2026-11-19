// Admin lifecycle step: Rooms, owners and ownership links. The paper ballot
// (enterPaperBallot) runs in the voting step, once the meeting is published.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { chooseSearchOption, gotoWithRetry } from "../admin-helpers";
import type { AfterMeetings } from "./meetings";

export async function people(page: Page, ctx: AfterMeetings) {
  const { roomNumber, ownerName, activeAppOrigin } = ctx;

  await page.goto(`${activeAppOrigin}/admin/people?tab=rooms`);
  await page.getByRole("link", { name: "Add room" }).click();
  const addRoomDrawer = page.getByRole("dialog", { name: "Add room" });
  await addRoomDrawer.locator('input[name="room_number"]').fill(roomNumber);
  await addRoomDrawer.locator('input[name="ownership_percent"]').fill("1.25");
  await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
  await page.waitForURL(
    new RegExp(`room=${encodeURIComponent(roomNumber)}`),
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.getByRole("cell", { name: roomNumber })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto(`${activeAppOrigin}/admin/people?tab=owners`);
  await page.getByRole("link", { name: "Add owner" }).click();
  const addOwnerDrawer = page.getByRole("dialog", { name: "Add owner" });
  await addOwnerDrawer.locator('input[name="full_name"]').fill(ownerName);
  await addOwnerDrawer.locator('input[name="email"]').fill("owner.demo@example.com");
  await addOwnerDrawer.getByRole("button", { name: "Create owner" }).click();
  await page.waitForURL(/\/admin\/people\?[\s\S]*name=/, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("cell", { name: ownerName })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto(`${activeAppOrigin}/admin/ownership`);
  const roomOwnershipSection = page
    .getByRole("heading", { name: "Room Ownership" })
    .locator("xpath=ancestor::section[1]");
  await roomOwnershipSection.getByRole("link", { name: "Create ownership link" }).click();
  const createOwnershipDrawer = page.getByLabel("Create ownership link");
  await chooseSearchOption(createOwnershipDrawer, "room_id", roomNumber);
  await chooseSearchOption(createOwnershipDrawer, "owner_id", ownerName);
  await createOwnershipDrawer.locator('input[name="starts_at"]').fill("2026-06-01");
  await createOwnershipDrawer.getByRole("button", { name: "Create ownership link" }).click();
  await page.waitForTimeout(1_000);
  // Room and owner filters: type to search, pick, search; the URL carries
  // the ids, not the room number or the name (2026-11-19, req_0006).
  await gotoWithRetry(page, `${activeAppOrigin}/admin/ownership`, { waitUntil: "load" });
  const ownershipFilter = page.locator("form:visible").filter({ has: page.locator('[data-focus-for="room"]') });
  await chooseSearchOption(ownershipFilter, "room", roomNumber);
  await chooseSearchOption(ownershipFilter, "owner", ownerName);
  await ownershipFilter.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/[?&]room=[0-9a-f-]{36}/);
  await expect(page).toHaveURL(/[?&]owner=[0-9a-f-]{36}/);
  const roomOwnerRow = roomOwnershipSection
    .getByRole("row")
    .filter({ hasText: roomNumber })
    .filter({ hasText: ownerName });
  await expect(roomOwnerRow).toBeVisible();
}

export type AfterPeople = AfterMeetings;

/** Paper ballot with a voter name only (pending identity). Runs after the
 * meeting is published: paper ballots need a published meeting (0044). */
export async function enterPaperBallot(page: Page, ctx: AfterMeetings) {
  const { roomNumber, meetingTitle, choiceText, manualAuditNote, activeAppOrigin } = ctx;

  await page.goto(`${activeAppOrigin}/admin/voting`);
  const manualVotesSection = page
    .getByRole("heading", { name: "Manual Votes" })
    .locator("xpath=ancestor::section[1]");
  await manualVotesSection.getByRole("link", { name: "Import manual vote" }).click();
  const importManualVoteDrawer = page.getByLabel("Import manual vote");
  await chooseSearchOption(importManualVoteDrawer, "meeting_id", meetingTitle);
  await chooseSearchOption(importManualVoteDrawer, "room_id", roomNumber);
  await importManualVoteDrawer
    .getByPlaceholder("Name on paper ballot when profile is not registered yet")
    .fill(manualAuditNote);
  await importManualVoteDrawer
    .getByRole("button", { name: "Continue to vote form" })
    .click();
  await expect(
    page.getByRole("heading", { name: `Manual vote entry: ${meetingTitle}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(choiceText).check();
  await page.getByRole("button", { name: "Save manual vote" }).click();
  await page.waitForURL(/\/admin\/voting\?[\s\S]*feedback=success/, {
    waitUntil: "domcontentloaded",
  });
  await page.goto(`${activeAppOrigin}/admin/voting`);
  const pendingManualIdentitySection = page
    .getByRole("heading", { name: "Pending manual vote identities" })
    .locator("xpath=ancestor::section[1]");
  await expect(
    pendingManualIdentitySection
      .locator("[data-pending-ballot-id]")
      .filter({ hasText: roomNumber })
      .filter({ hasText: manualAuditNote }),
  ).toBeVisible({ timeout: 15_000 });
}
