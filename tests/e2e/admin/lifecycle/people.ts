// Admin lifecycle step: Rooms, paper ballot import, owners and ownership links.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { chooseSearchOption, gotoWithRetry } from "../admin-helpers";
import type { AfterMeetings } from "./meetings";

export async function people(page: Page, ctx: AfterMeetings) {
  const { roomNumber, ownerName, meetingTitle, choiceText, manualAuditNote, activeAppOrigin } = ctx;

  await page.goto(`${activeAppOrigin}/admin/people?tab=rooms`);
  await page.getByRole("link", { name: "Add room" }).click();
  const addRoomDrawer = page.getByRole("complementary", { name: "Add room" });
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

  await page.goto(`${activeAppOrigin}/admin/voting`);
  const manualVotesSection = page
    .getByRole("heading", { name: "Manual Votes" })
    .locator("xpath=ancestor::section[1]");
  await manualVotesSection.getByRole("link", { name: "Import manual vote" }).click();
  const importManualVoteDrawer = page.getByLabel("Import manual vote");
  await importManualVoteDrawer
    .locator('select[name="meeting_id"]')
    .selectOption({ label: meetingTitle });
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
  await page.waitForURL("**/admin/voting", { waitUntil: "domcontentloaded" });
  await page.goto(`${activeAppOrigin}/admin/voting`);
  const pendingManualIdentitySection = page
    .getByRole("heading", { name: "Pending manual vote identities" })
    .locator("xpath=ancestor::section[1]");
  await expect(
    pendingManualIdentitySection
      .getByRole("row")
      .filter({ hasText: roomNumber })
      .filter({ hasText: manualAuditNote }),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto(`${activeAppOrigin}/admin/people?tab=owners`);
  await page.getByRole("link", { name: "Add owner" }).click();
  const addOwnerDrawer = page.getByRole("complementary", { name: "Add owner" });
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
  await gotoWithRetry(
    page,
    `${activeAppOrigin}/admin/ownership?room=${encodeURIComponent(roomNumber)}&owner=${encodeURIComponent(ownerName)}`,
    { waitUntil: "commit" },
  );
  const roomOwnerRow = roomOwnershipSection
    .getByRole("row")
    .filter({ hasText: roomNumber })
    .filter({ hasText: ownerName });
  await expect(roomOwnerRow).toBeVisible();
}

export type AfterPeople = AfterMeetings;
