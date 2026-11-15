// Admin lifecycle step: Owner voting and stored ballot checks.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AfterProxies } from "./proxies";

export async function voting(page: Page, ctx: AfterProxies) {
  const {
    supabase,
    roomNumber,
    meetingTitle,
    questionText,
    choiceText,
    updatedChoiceText,
    profile,
    activeAppOrigin,
  } = ctx;

  await page.goto(
    `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
  );
  const meetingRow = page.getByRole("row").filter({ hasText: meetingTitle });
  await meetingRow.getByRole("button", { name: "Publish" }).click();
  await expect(
    meetingRow.getByRole("cell", { name: "published", exact: true }),
  ).toBeVisible();

  await page.goto(`${activeAppOrigin}/vote`);
  const voteAssignment = page
    .getByRole("heading", { name: meetingTitle })
    .locator("xpath=ancestor::section[1]");
  await expect(voteAssignment.getByText(`Room ${roomNumber}`)).toBeVisible();
  await voteAssignment.getByRole("link", { name: "Open ballot" }).click();
  await expect(page).toHaveURL(/\/vote\/[^/]+\/[^/]+$/);
  const voteDetailUrl = page.url();
  const voteCard = page
    .getByRole("heading", { name: meetingTitle })
    .locator("xpath=ancestor::main[1]");
  await expect(
    voteCard.getByText("You can change your ballot until voting closes.", {
      exact: false,
    }),
  ).toBeVisible();
  await voteCard.getByLabel(choiceText).check();
  await voteCard.getByRole("button", { name: "Submit ballot" }).click();
  await expect(voteCard.getByText("Submitted v1")).toBeVisible();
  await voteCard.getByLabel(updatedChoiceText).check();
  await voteCard.getByRole("button", { name: "Update ballot" }).click();
  await expect(voteCard.getByText("Submitted v2")).toBeVisible();
  const versionHistory = page
    .getByRole("heading", { name: "Version history" })
    .locator("xpath=ancestor::section[1]");
  await expect(versionHistory.getByText("Version v2")).toBeVisible();
  await expect(versionHistory.getByText("Version v1")).toBeVisible();
  await expect(versionHistory.getByText(choiceText)).toBeVisible();
  await expect(versionHistory.getByText(updatedChoiceText)).toBeVisible();

  const [
    persistedMeetingResult,
    persistedRoomResult,
    persistedQuestionResult,
    persistedChoiceResult,
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("id")
      .eq("title", meetingTitle)
      .single(),
    supabase.from("rooms").select("id").eq("room_number", roomNumber).single(),
    supabase
      .from("meeting_questions")
      .select("id")
      .eq("question_text", questionText)
      .single(),
    supabase
      .from("meeting_choices")
      .select("id")
      .eq("choice_text", updatedChoiceText)
      .single(),
  ]);

  expect(persistedMeetingResult.error).toBeNull();
  expect(persistedRoomResult.error).toBeNull();
  expect(persistedQuestionResult.error).toBeNull();
  expect(persistedChoiceResult.error).toBeNull();

  const { data: persistedBallot, error: persistedBallotError } = await supabase
    .from("ballots")
    .select(
      "id, status, version_number, ballot_answers(question_id, choice_id), ballot_versions(version_number)",
    )
    .eq("meeting_id", persistedMeetingResult.data!.id)
    .eq("room_id", persistedRoomResult.data!.id)
    .eq("voter_profile_id", profile!.id)
    .single();

  expect(persistedBallotError).toBeNull();
  expect(persistedBallot?.status).toBe("submitted");
  expect(persistedBallot?.version_number).toBe(2);
  expect(
    persistedBallot?.ballot_answers.some(
      (answer) =>
        answer.question_id === persistedQuestionResult.data!.id &&
        answer.choice_id === persistedChoiceResult.data!.id,
    ),
  ).toBe(true);
  expect(
    persistedBallot?.ballot_versions
      .map((version) => version.version_number)
      .sort((left, right) => left - right),
  ).toEqual([1, 2]);

  return { voteDetailUrl, persistedMeetingResult, persistedRoomResult };
}

export type AfterVoting = AfterProxies & Awaited<ReturnType<typeof voting>>;
