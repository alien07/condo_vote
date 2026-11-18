import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  chooseSearchOption,
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: paper ballots and conflicts", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("voting CRUD rollout validates and focuses resolved manual votes", async ({
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

    const stamp = Date.now();
    const meetingTitle = `Manual rollout ${stamp}`;
    const roomNumber = `MANUAL-${stamp}`;
    const questionText = `Manual rollout item ${stamp}?`;
    const choiceText = `Approve manual ${stamp}`;
    const pendingName = `Paper voter ${stamp}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let manualBallotId: string | null = null;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        ends_at: endsAt,
        published_at: new Date().toISOString(),
        starts_at: startsAt,
        status: "published",
        title: meetingTitle,
      })
      .select("id")
      .single();

    expect(meetingError).toBeNull();
    const { data: question, error: questionError } = await supabase
      .from("meeting_questions")
      .insert({
        display_order: 1,
        meeting_id: meeting!.id,
        question_text: questionText,
        question_type: "single_choice",
      })
      .select("id")
      .single();

    expect(questionError).toBeNull();
    const { data: choice, error: choiceError } = await supabase
      .from("meeting_choices")
      .insert({
        choice_text: choiceText,
        display_order: 1,
        question_id: question!.id,
      })
      .select("id")
      .single();

    expect(choiceError).toBeNull();
    const { data: manualBallot, error: manualBallotError } = await supabase
      .from("manual_ballots")
      .insert({
        identity_status: "pending",
        imported_by: profile!.id,
        meeting_id: meeting!.id,
        room_id: room!.id,
        source_label: "manual_pending_identity",
        status: "draft",
        voter_identity_text: pendingName,
      })
      .select("id")
      .single();

    expect(manualBallotError).toBeNull();
    manualBallotId = manualBallot!.id;
    const { error: answerError } = await supabase
      .from("manual_ballot_answers")
      .insert({
        choice_id: choice!.id,
        manual_ballot_id: manualBallotId,
        question_id: question!.id,
      });

    expect(answerError).toBeNull();
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

    try {
      await page.goto(
        `${appUrl}/admin/voting?meeting=${encodeURIComponent(
          meetingTitle,
        )}&sort=meeting&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Import manual vote" }).click();
      const importDrawer = page.getByRole("complementary", {
        name: "Import manual vote",
      });

      await importDrawer.getByRole("button", { name: "Continue to vote form" }).click();
      await expect(importDrawer.getByText("Meeting is required.")).toBeVisible();
      await expect(importDrawer.getByText("Room is required.")).toBeVisible();
      await expect(importDrawer.locator('select[name="meeting_id"]')).toBeFocused();

      await importDrawer
        .locator('select[name="meeting_id"]')
        .selectOption({ label: meetingTitle });
      await chooseSearchOption(importDrawer, "room_id", roomNumber);
      await importDrawer.locator('input[name="voter_identity_text"]').fill(pendingName);
      await importDrawer.getByRole("button", { name: "Continue to vote form" }).click();
      await expect(page).toHaveURL(/\/admin\/voting\/manual\//);

      await page.goto(
        `${appUrl}/admin/voting?meeting=${encodeURIComponent(
          meetingTitle,
        )}&sort=meeting&dir=asc&perPage=25`,
      );
      const pendingRow = page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .filter({ hasText: pendingName });

      await pendingRow.getByRole("link", { name: "Link profile" }).click();
      const resolveDrawer = page.getByRole("complementary", {
        name: "Resolve manual vote identity",
      });

      await resolveDrawer.getByRole("button", { name: "Link profile" }).click();
      await confirmInApp(page);
      await expect(resolveDrawer.getByText("Voter profile is required.")).toBeVisible();
      await expect(resolveDrawer.locator('[data-focus-for="voter_profile_id"]')).toBeFocused();

      await chooseSearchOption(resolveDrawer, "voter_profile_id", demoAdminEmail);
      await resolveDrawer.getByRole("button", { name: "Link profile" }).click();
      await confirmInApp(page);

      const resultRow = page.locator(
        `tr[data-manual-ballot-id="${manualBallotId}"]:visible`,
      );

      await expect(resultRow).toBeVisible({ timeout: 15_000 });
      await expect(resultRow).toContainText("linked");
    } finally {
      if (manualBallotId) {
        await supabase.from("audit_logs").delete().eq("entity_id", manualBallotId);
        await supabase
          .from("manual_ballot_answers")
          .delete()
          .eq("manual_ballot_id", manualBallotId);
        await supabase.from("manual_ballots").delete().eq("id", manualBallotId);
      }

      if (choice?.id) {
        await supabase.from("meeting_choices").delete().eq("id", choice.id);
      }

      if (question?.id) {
        await supabase.from("meeting_questions").delete().eq("id", question.id);
      }

      if (meeting?.id) {
        await supabase.from("meetings").delete().eq("id", meeting.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }
    }
  });

  test("vote conflict rollout resolves from review drawer", async ({ page }) => {
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

    const stamp = Date.now();
    const meetingTitle = `Conflict rollout ${stamp}`;
    const roomNumber = `CONFLICT-${stamp}`;
    const questionText = `Conflict rollout item ${stamp}?`;
    const manualChoiceText = `Manual choice ${stamp}`;
    const onlineChoiceText = `Online choice ${stamp}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let manualBallotId: string | null = null;
    let onlineBallotId: string | null = null;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        ends_at: endsAt,
        published_at: new Date().toISOString(),
        starts_at: startsAt,
        status: "published",
        title: meetingTitle,
      })
      .select("id")
      .single();

    expect(meetingError).toBeNull();
    const { data: question, error: questionError } = await supabase
      .from("meeting_questions")
      .insert({
        display_order: 1,
        meeting_id: meeting!.id,
        question_text: questionText,
        question_type: "single_choice",
      })
      .select("id")
      .single();

    expect(questionError).toBeNull();
    const { data: choices, error: choicesError } = await supabase
      .from("meeting_choices")
      .insert([
        {
          choice_text: manualChoiceText,
          display_order: 1,
          question_id: question!.id,
        },
        {
          choice_text: onlineChoiceText,
          display_order: 2,
          question_id: question!.id,
        },
      ])
      .select("id, choice_text");

    expect(choicesError).toBeNull();
    const manualChoice = choices!.find(
      (choice) => choice.choice_text === manualChoiceText,
    );
    const onlineChoice = choices!.find(
      (choice) => choice.choice_text === onlineChoiceText,
    );

    expect(manualChoice).toBeTruthy();
    expect(onlineChoice).toBeTruthy();

    const { data: manualBallot, error: manualBallotError } = await supabase
      .from("manual_ballots")
      .insert({
        identity_status: "linked",
        imported_by: profile!.id,
        meeting_id: meeting!.id,
        room_id: room!.id,
        source_label: "manual_on_site",
        status: "submitted",
        voter_profile_id: profile!.id,
      })
      .select("id")
      .single();

    expect(manualBallotError).toBeNull();
    manualBallotId = manualBallot!.id;

    const { error: manualAnswerError } = await supabase
      .from("manual_ballot_answers")
      .insert({
        choice_id: manualChoice!.id,
        manual_ballot_id: manualBallotId,
        question_id: question!.id,
      });

    expect(manualAnswerError).toBeNull();

    const { data: onlineBallot, error: onlineBallotError } = await supabase
      .from("ballots")
      .insert({
        meeting_id: meeting!.id,
        room_id: room!.id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        voter_profile_id: profile!.id,
      })
      .select("id")
      .single();

    expect(onlineBallotError).toBeNull();
    onlineBallotId = onlineBallot!.id;

    const { error: onlineAnswerError } = await supabase
      .from("ballot_answers")
      .insert({
        ballot_id: onlineBallotId,
        choice_id: onlineChoice!.id,
        question_id: question!.id,
      });

    expect(onlineAnswerError).toBeNull();
    const { error: eligibleError } = await supabase
      .from("eligible_voters_snapshot")
      .insert({
        meeting_id: meeting!.id,
        ownership_percent: 1,
        profile_id: profile!.id,
        room_id: room!.id,
        source: "owner_master",
        voter_type: "owner",
      });

    expect(eligibleError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    try {
      await page.goto(
        `${appUrl}/admin/voting/conflicts?meeting=${encodeURIComponent(
          meetingTitle,
        )}&room=${encodeURIComponent(roomNumber)}`,
      );
      const conflictRow = page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .filter({ hasText: roomNumber });

      await expect(conflictRow.getByRole("cell", { name: "unresolved" })).toBeVisible();
      await conflictRow.getByRole("button", { name: "Review / Resolve" }).click();
      const reviewDrawer = page.getByRole("dialog", {
        name: "Review vote source conflict",
      });

      await expect(reviewDrawer.getByText(manualChoiceText)).toBeVisible();
      await expect(reviewDrawer.getByText(onlineChoiceText)).toBeVisible();
      await reviewDrawer.locator('select[name="chosen_source"]').selectOption("online");
      await reviewDrawer
        .getByPlaceholder("Explain why this source is selected.")
        .fill("Use online rollout vote");
      await reviewDrawer.getByRole("button", { name: "Resolve source" }).click();

      await expect(reviewDrawer).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText("Conflict resolved.")).toBeVisible();
      await expect(
        conflictRow.getByRole("cell", { name: "resolved", exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      const { data: resolution, error: resolutionError } = await supabase
        .from("vote_source_resolutions")
        .select("chosen_source, chosen_ballot_id, conflict_remark")
        .eq("meeting_id", meeting!.id)
        .eq("room_id", room!.id)
        .single();

      expect(resolutionError).toBeNull();
      expect(resolution).toMatchObject({
        chosen_ballot_id: onlineBallotId,
        chosen_source: "online",
        conflict_remark: "Use online rollout vote",
      });
    } finally {
      if (meeting?.id && room?.id) {
        await supabase
          .from("vote_source_resolutions")
          .delete()
          .eq("meeting_id", meeting.id)
          .eq("room_id", room.id);
      }

      if (onlineBallotId) {
        await supabase.from("ballot_answers").delete().eq("ballot_id", onlineBallotId);
        await supabase.from("ballots").delete().eq("id", onlineBallotId);
      }

      if (meeting?.id && room?.id) {
        await supabase
          .from("eligible_voters_snapshot")
          .delete()
          .eq("meeting_id", meeting.id)
          .eq("room_id", room.id);
      }

      if (manualBallotId) {
        await supabase
          .from("manual_ballot_answers")
          .delete()
          .eq("manual_ballot_id", manualBallotId);
        await supabase.from("manual_ballots").delete().eq("id", manualBallotId);
      }

      if (question?.id) {
        await supabase.from("meeting_choices").delete().eq("question_id", question.id);
        await supabase.from("meeting_questions").delete().eq("id", question.id);
      }

      if (meeting?.id) {
        await supabase.from("meetings").delete().eq("id", meeting.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }
    }
  });
});
