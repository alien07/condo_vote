import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
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
      const addDrawer = page.getByRole("complementary", {
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
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusMeetingId")));

      const meetingId = new URL(page.url()).searchParams.get("focusMeetingId");

      expect(meetingId).toBeTruthy();
      await expect(page).toHaveURL(/sort=title/);
      await expect(page).toHaveURL(/dir=desc/);
      await expect(page).toHaveURL(/perPage=25/);

      const createdRow = page.locator(
        `tr[data-meeting-id="${meetingId}"]:visible`,
      );

      await expect(createdRow).toBeVisible();
      await expect(createdRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(
        createdRow.getByRole("button", { name: "Publish" }),
      ).toBeVisible();
      await expect(
        createdRow.getByRole("button", { name: "Archive" }),
      ).toBeVisible();
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-meeting-id") === id,
        meetingId,
      );

      await createdRow.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("complementary", {
        name: "Edit meeting",
      });

      await editDrawer.getByPlaceholder("Location / platform").fill("Updated");
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
      await page.goto(`${appUrl}/admin/meetings?tab=questions`);
      await page.getByRole("link", { name: "Add question" }).click();
      const addDrawer = page.getByRole("complementary", {
        name: "Add question",
      });

      await addDrawer.getByRole("button", { name: "Add question" }).click();
      await expect(addDrawer.getByText("Meeting is required.")).toBeVisible();
      await expect(addDrawer.getByText("Question is required.")).toBeVisible();
      await expect(addDrawer.locator('select[name="meeting_id"]')).toBeFocused();

      await addDrawer.locator('input[name="question_text"]').fill(questionText);
      await addDrawer.getByRole("button", { name: "Add question" }).click();
      await expect(addDrawer.getByText("Meeting is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="question_text"]')).toHaveValue(
        questionText,
      );
      await expect(addDrawer.locator('select[name="meeting_id"]')).toBeFocused();

      await addDrawer
        .locator('select[name="meeting_id"]')
        .selectOption(meeting!.id);
      await addDrawer.locator('input[name="display_order"]').fill("1");
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

      await questionCard.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("complementary", {
        name: "Edit question",
      });

      await expect(editDrawer).toBeVisible({ timeout: 15_000 });
      await expect(editDrawer.locator('input[name="question_text"]')).toHaveValue(
        questionText,
      );
      await editDrawer
        .locator('input[name="question_text"]')
        .fill(updatedQuestionText);
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
    } finally {
      await supabase.from("meeting_questions").delete().eq("meeting_id", meeting!.id);
      await supabase.from("meetings").delete().eq("id", meeting!.id);
    }
  });
});
