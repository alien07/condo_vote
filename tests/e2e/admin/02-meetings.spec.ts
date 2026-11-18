import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { confirmInApp } from "../confirm-dialog";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  toDateTimeLocal,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: meetings and questions", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("meetings CRUD rollout preserves state and focuses saved rows", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    const stamp = Date.now();
    const createdTitle = `Meeting rollout ${stamp}`;
    const publishedTitle = `Published rollout ${stamp}`;
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { error: publishedError } = await supabase.from("meetings").insert({
      title: publishedTitle,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "published",
      published_at: new Date().toISOString(),
    });

    expect(publishedError).toBeNull();

    try {
      await page.goto(
        `${appUrl}/admin/meetings?tab=meetings&sort=title&dir=desc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add meeting" }).click();
      const addDrawer = page.getByRole("dialog", {
        name: "Add meeting",
      });

      await addDrawer.getByRole("button", { name: "Add meeting" }).click();
      await expect(addDrawer.getByText("Meeting title is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="title"]')).toBeFocused();

      await addDrawer.locator('input[name="title"]').fill(createdTitle);
      await addDrawer
        .locator('input[name="starts_at"]')
        .fill(toDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)));
      await addDrawer
        .locator('input[name="ends_at"]')
        .fill(toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
      await addDrawer.getByRole("button", { name: "Add meeting" }).click();
      await expect(addDrawer.getByText("End time must be after start time.")).toBeVisible();
      await expect(addDrawer.locator('input[name="title"]')).toHaveValue(
        createdTitle,
      );
      await expect(addDrawer.locator('input[name="ends_at"]')).toBeFocused();

      await addDrawer
        .locator('input[name="ends_at"]')
        .fill(toDateTimeLocal(new Date(Date.now() + 3 * 60 * 60 * 1000)));
      await addDrawer.getByRole("button", { name: "Add meeting" }).click();
      // A new meeting opens its agenda, the next step (2026-11-18 review).
      await page.waitForURL(
        (url) => url.searchParams.get("tab") === "questions" && Boolean(url.searchParams.get("meeting")),
      );

      const meetingId = new URL(page.url()).searchParams.get("meeting");

      expect(meetingId).toBeTruthy();
      const steps = page.locator("[data-meeting-steps]");

      await expect(steps.locator('[data-step="info"]')).toContainText(createdTitle);
      await expect(steps.locator('[data-step="agenda"]')).toContainText("No agenda item yet");
      await expect(steps.getByRole("button", { name: "Publish" })).toHaveCount(0);

      const listUrl = `${appUrl}/admin/meetings?tab=meetings&sort=title&dir=desc&perPage=25&title=${encodeURIComponent(createdTitle)}`;

      await page.goto(listUrl);
      const createdRow = page.locator(
        `tr[data-meeting-id="${meetingId}"]:visible`,
      );

      await expect(createdRow).toBeVisible();
      // A draft shows its next step; publishing waits for an agenda.
      await expect(createdRow.getByRole("link", { name: "Agenda (0)" })).toBeVisible();
      await expect(createdRow.getByRole("button", { name: "Publish" })).toHaveCount(0);
      await expect(createdRow.locator("[data-publish-blocked]")).toContainText("No agenda item yet");
      await createdRow.getByText("More", { exact: true }).click();
      await expect(
        createdRow.getByRole("button", { name: "Archive" }),
      ).toBeVisible();

      await createdRow.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("dialog", {
        name: "Edit meeting",
      });

      await editDrawer.getByLabel("Location / platform").fill("Updated");
      await editDrawer.getByRole("button", { name: "Save meeting" }).click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("focusMeetingId") === meetingId &&
          !url.searchParams.has("mode"),
      );
      await expect(page).toHaveURL(/sort=title/);
      await expect(page).toHaveURL(/dir=desc/);
      await expect(page).toHaveURL(/perPage=25/);
      await expect(createdRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-meeting-id") === id,
        meetingId,
      );

      // Esc closes the panel (2026-11-18 review).
      await createdRow.getByText("More", { exact: true }).click();
      await createdRow.getByRole("link", { name: "Edit" }).click();
      await expect(editDrawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(editDrawer).toHaveCount(0);

      await page.goto(
        `${appUrl}/admin/meetings?tab=meetings&title=${encodeURIComponent(
          publishedTitle,
        )}`,
      );
      const publishedRow = page
        .getByRole("row")
        .filter({ hasText: publishedTitle });

      await expect(publishedRow).toBeVisible();
      await expect(
        publishedRow.getByRole("link", { name: "Edit" }),
      ).toHaveCount(0);
      await publishedRow.getByText("More", { exact: true }).click();
      await expect(
        publishedRow.getByRole("button", { name: "Archive" }),
      ).toBeVisible();
      // Voting has not ended, so results wait (D014).
      await expect(publishedRow.getByText("Voting open")).toBeVisible();
      await expect(
        publishedRow.getByRole("button", { name: "Generate result" }),
      ).toHaveCount(0);
    } finally {
      await supabase
        .from("meetings")
        .delete()
        .in("title", [createdTitle, publishedTitle]);
    }
  });

  test("questions CRUD rollout validates and focuses saved questions", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();
    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    const stamp = Date.now();
    const meetingTitle = `Question rollout meeting ${stamp}`;
    const questionText = `Question rollout ${stamp}`;
    const updatedQuestionText = `${questionText} updated`;
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        title: meetingTitle,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();

    expect(meetingError).toBeNull();

    try {
      await page.goto(`${appUrl}/admin/meetings?tab=questions&meeting=${meeting!.id}`);
      await page.getByRole("link", { name: "Add question" }).click();
      const addDrawer = page.getByRole("dialog", {
        name: "Add question",
      });

      // The agenda belongs to the meeting it was opened from.
      await expect(addDrawer.locator("[data-fixed-meeting]")).toContainText(meetingTitle);
      await addDrawer.getByRole("button", { name: "Add question" }).click();
      await expect(addDrawer.getByText("Question is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="question_text"]')).toBeFocused();

      // Fields that apply only to some choices stay hidden until then.
      await expect(addDrawer.locator('input[name="max_choices"]')).toHaveCount(0);
      await expect(addDrawer.locator("[data-custom-rule]")).toHaveCount(0);
      await addDrawer.locator('select[name="question_type"]').selectOption("multiple_choice");
      await expect(addDrawer.getByLabel("Max choices (multiple choice only)")).toBeVisible();
      await addDrawer.locator('select[name="question_type"]').selectOption("single_choice");
      await addDrawer.locator('select[name="required_threshold"]').selectOption("custom");
      await expect(addDrawer.locator("[data-custom-rule]")).toBeVisible();
      await addDrawer.locator('select[name="required_threshold"]').selectOption("majority_submitted");

      await addDrawer.getByLabel("Agenda no.").fill("1");
      await addDrawer.locator('input[name="question_text"]').fill(questionText);
      await addDrawer.getByRole("button", { name: "Add question" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusQuestionId")));

      const questionId = new URL(page.url()).searchParams.get("focusQuestionId");

      expect(questionId).toBeTruthy();
      await expect(page).toHaveURL(/tab=questions/);
      const questionCard = page.locator(
        `[data-question-id="${questionId}"]:visible`,
      );

      await expect(questionCard).toBeVisible();
      await expect(questionCard).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(
        questionCard.getByRole("link", { name: "Edit" }),
      ).toBeVisible();
      await expect(
        questionCard.getByRole("button", { name: "Delete question" }),
      ).toBeVisible();
      await expect(
        questionCard.getByRole("button", { name: "Add choice" }),
      ).toBeVisible();
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-question-id") === id,
        questionId,
      );

      // Words, not codes, and a new item goes last (order 1 here).
      await expect(questionCard.locator("[data-agenda-line]")).toHaveText(
        "Agenda 1 · Single choice · Ordinary · More than 50% of voting ownership",
      );
      const { data: saved } = await supabase
        .from("meeting_questions")
        .select("display_order")
        .eq("id", questionId!)
        .single();

      expect(saved?.display_order).toBe(1);
      // Only Abstain so far: not ready to publish.
      const agendaStep = page.locator('[data-meeting-steps] [data-step="agenda"]');

      await expect(agendaStep).toContainText("No choices yet");
      await questionCard.getByRole("textbox", { name: "New choice" }).fill("Approve");
      await questionCard.getByRole("button", { name: "Add choice" }).click();
      await expect(questionCard.locator("[data-choice-list] li").first()).toContainText("Approve");
      await expect(agendaStep).toHaveAttribute("data-step-done", "true");

      // Ballot preview: try it as an owner, nothing is saved (2026-11-18).
      await page.getByRole("link", { name: "Preview ballot" }).click();
      const preview = page.getByRole("dialog", { name: "Ballot preview" });

      await expect(preview).toBeVisible();
      await preview.getByRole("button", { name: "Submit ballot" }).click();
      await expect(preview.getByText("Choose an answer for this question.")).toBeVisible();
      await preview.getByLabel("Approve").check();
      await preview.getByRole("button", { name: "Submit ballot" }).click();
      await expect(preview.locator("[data-preview-done]")).toBeVisible();
      const { count: ballotCount } = await supabase
        .from("ballots")
        .select("id", { count: "exact", head: true })
        .eq("meeting_id", meeting!.id);

      expect(ballotCount).toBe(0);
      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);

      await questionCard.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("dialog", {
        name: "Edit question",
      });

      await expect(editDrawer).toBeVisible({ timeout: 15_000 });
      await expect(editDrawer.locator('input[name="question_text"]')).toHaveValue(
        questionText,
      );
      await editDrawer
        .locator('input[name="question_text"]')
        .fill(updatedQuestionText);
      // Abstain is off until the item needs it (0041).
      const hasAbstain = editDrawer.getByLabel("Has an Abstain choice");

      await expect(hasAbstain).not.toBeChecked();
      await hasAbstain.check();
      await editDrawer.getByRole("button", { name: "Save question" }).click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("focusQuestionId") === questionId &&
          !url.searchParams.has("mode"),
      );
      await expect(
        questionCard.getByRole("heading", { name: updatedQuestionText }),
      ).toBeVisible();
      await expect(questionCard).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-question-id") === id,
        questionId,
      );
      // Abstain is last, fixed, and cannot be edited.
      const abstainRow = questionCard.locator("[data-abstain-row]");

      await expect(abstainRow).toContainText("Abstain");
      await expect(abstainRow).toContainText("Cannot be combined with other choices");
      await expect(questionCard.locator("[data-choice-list] li").last()).toContainText("Abstain");

      // An agenda item with choices can be deleted; its choices go with it (0042).
      await questionCard.getByRole("button", { name: "Delete question" }).click();
      await confirmInApp(page);
      await expect(questionCard).toHaveCount(0);
      const { count: choicesLeft } = await supabase
        .from("meeting_choices")
        .select("id", { count: "exact", head: true })
        .eq("question_id", questionId!);

      expect(choicesLeft).toBe(0);
    } finally {
      await supabase.from("meeting_questions").delete().eq("meeting_id", meeting!.id);
      await supabase.from("meetings").delete().eq("id", meeting!.id);
    }
  });
});
