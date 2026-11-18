// Admin lifecycle step: Meetings and agenda questions.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AfterSetupPages } from "./setup-pages";

export async function meetings(page: Page, ctx: AfterSetupPages) {
  const {
    meetingTitle,
    committeeName,
    questionText,
    choiceText,
    updatedChoiceText,
    startsAt,
    endsAt,
    activeAppOrigin,
  } = ctx;

  await page.goto(
    `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
  );
  await page.getByRole("link", { name: "Add meeting" }).click();
  const addMeetingDrawer = page.getByLabel("Add meeting");
  await addMeetingDrawer.locator('input[name="title"]').fill(meetingTitle);
  await addMeetingDrawer.locator('input[name="meeting_number"]').fill("AGM-2026-001");
  await addMeetingDrawer.locator('input[name="fiscal_year"]').fill("2026");
  await addMeetingDrawer.getByLabel("Location / platform").fill("Online");
  // Chairperson is a search box that also takes a typed name.
  const chairBox = addMeetingDrawer.locator('[data-focus-for="chairperson_name"]');
  await chairBox.click();
  await chairBox.fill(committeeName);
  await chairBox.press("Tab");
  await expect(addMeetingDrawer.locator('input[name="chairperson_name"]')).toHaveValue(committeeName);
  await addMeetingDrawer.locator('input[name="starts_at"]').fill(startsAt);
  await addMeetingDrawer.locator('input[name="ends_at"]').fill(endsAt);
  await addMeetingDrawer.getByRole("button", { name: "Add meeting" }).click();
  // A new meeting opens its agenda, the next step (2026-11-18 review).
  await page.waitForURL(/\/admin\/meetings\?[\s\S]*tab=questions[\s\S]*meeting=/, {
    waitUntil: "domcontentloaded",
  });

  const questionsSection = page
    .getByRole("heading", { name: "Questions And Choices" })
    .locator("xpath=ancestor::section[1]");
  await questionsSection.getByRole("link", { name: "Add question" }).click();
  const addQuestionDrawer = page.getByLabel("Add question");
  await expect(addQuestionDrawer.locator("[data-fixed-meeting]")).toContainText(meetingTitle);
  await addQuestionDrawer.getByLabel("Agenda no.").fill("1");
  await addQuestionDrawer.getByLabel("Agenda title").fill("Approve demo agenda");
  await addQuestionDrawer.locator('input[name="question_text"]').fill(questionText);
  await addQuestionDrawer
    .locator('select[name="required_threshold"]')
    .selectOption("majority_submitted");
  await addQuestionDrawer.getByRole("button", { name: "Add question" }).click();
  await page.waitForURL(/\/admin\/meetings\?[\s\S]*focusQuestionId=/, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    questionsSection.getByRole("heading", { name: questionText }),
  ).toBeVisible({ timeout: 15_000 });
  const questionCard = questionsSection.locator("[data-question-id]").filter({
    // `has` is resolved inside each card, so it must not start from the section.
    has: page.getByRole("heading", { name: questionText }),
  });
  await questionCard.getByRole("textbox", { name: "Choice" }).fill(choiceText);
  await questionCard.getByRole("button", { name: "Add choice" }).click();
  await expect(
    questionCard.locator("span").filter({ hasText: choiceText }),
  ).toBeVisible({ timeout: 15_000 });
  await questionCard
    .getByRole("textbox", { name: "Choice" })
    .fill(updatedChoiceText);
  await questionCard.getByRole("button", { name: "Add choice" }).click();
  await expect(
    questionCard.locator("span").filter({ hasText: updatedChoiceText }),
  ).toBeVisible({ timeout: 15_000 });
}

export type AfterMeetings = AfterSetupPages;
