// Admin lifecycle step: Database fixtures: demo admin, future/closed meetings, ownership link.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
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
} from "../admin-helpers";

export async function fixtures(page: Page) {
  const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const roomNumber = `DEMO-${Date.now()}`;
  const ownerName = `Demo Owner ${Date.now()}`;
  const meetingTitle = `Demo Meeting ${Date.now()}`;
  const committeeName = `Demo Chair ${Date.now()}`;
  const questionText = `Approve item ${Date.now()}?`;
  const choiceText = `Yes ${Date.now()}`;
  const updatedChoiceText = `No ${Date.now()}`;
  const futureRoomNumber = `FUTURE-${Date.now()}`;
  const futureMeetingTitle = `Future Vote ${Date.now()}`;
  const futureQuestionText = `Future item ${Date.now()}?`;
  const closedRoomNumber = `CLOSED-${Date.now()}`;
  const closedMeetingTitle = `Closed Vote ${Date.now()}`;
  const closedQuestionText = `Closed item ${Date.now()}?`;
  const manualAuditNote = `Batch A row ${Date.now()}`;
  const documentSetKey = `demo-owner-verification-${Date.now()}`;
  const documentPath = `/private/condovotes-demo/${documentSetKey}.pdf`;
  const startsAt = toDateTimeLocal(new Date(Date.now() - 60 * 60 * 1000));
  const endsAt = toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000));

  let user = await findUserByEmail(supabase, demoAdminEmail);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoAdminEmail,
      email_confirm: true,
      user_metadata: {
        full_name: demoAdminName,
      },
    });

    expect(error).toBeNull();
    expect(data.user).toBeTruthy();
    user = data.user;
  }

  if (!user) {
    throw new Error("Demo admin user was not created.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        auth_user_id: user.id,
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
      // Storage settings need the system admin role (D016).
      { profile_id: profile!.id, role: "system_admin" },
    ],
    { onConflict: "profile_id,role" },
  );

  expect(roleError).toBeNull();

  const futureStartsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const futureEndsAt = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const closedStartsAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const closedEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ data: futureRoom }, { data: closedRoom }] = await Promise.all([
    supabase
      .from("rooms")
      .insert({
        room_number: futureRoomNumber,
        ownership_percent: 1,
      })
      .select("id")
      .single(),
    supabase
      .from("rooms")
      .insert({
        room_number: closedRoomNumber,
        ownership_percent: 1,
      })
      .select("id")
      .single(),
  ]);

  expect(futureRoom).toBeTruthy();
  expect(closedRoom).toBeTruthy();

  const [{ data: futureMeeting }, { data: closedMeeting }] =
    await Promise.all([
      supabase
        .from("meetings")
        .insert({
          title: futureMeetingTitle,
          starts_at: futureStartsAt.toISOString(),
          ends_at: futureEndsAt.toISOString(),
          status: "published",
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      supabase
        .from("meetings")
        .insert({
          title: closedMeetingTitle,
          starts_at: closedStartsAt.toISOString(),
          ends_at: closedEndsAt.toISOString(),
          status: "published",
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
    ]);

  expect(futureMeeting).toBeTruthy();
  expect(closedMeeting).toBeTruthy();

  const [{ data: futureQuestion }, { data: closedQuestion }] =
    await Promise.all([
      supabase
        .from("meeting_questions")
        .insert({
          meeting_id: futureMeeting!.id,
          question_text: futureQuestionText,
        })
        .select("id")
        .single(),
      supabase
        .from("meeting_questions")
        .insert({
          meeting_id: closedMeeting!.id,
          question_text: closedQuestionText,
        })
        .select("id")
        .single(),
    ]);

  expect(futureQuestion).toBeTruthy();
  expect(closedQuestion).toBeTruthy();

  const [{ error: futureChoiceError }, { error: closedChoiceError }] =
    await Promise.all([
      supabase.from("meeting_choices").insert({
        question_id: futureQuestion!.id,
        choice_text: "Approve",
      }),
      supabase.from("meeting_choices").insert({
        question_id: closedQuestion!.id,
        choice_text: "Approve",
      }),
    ]);

  expect(futureChoiceError).toBeNull();
  expect(closedChoiceError).toBeNull();

  const [{ error: futureEligibilityError }, { error: closedEligibilityError }] =
    await Promise.all([
      supabase.from("eligible_voters_snapshot").insert({
        meeting_id: futureMeeting!.id,
        room_id: futureRoom!.id,
        profile_id: profile!.id,
        voter_type: "owner",
        ownership_percent: 1,
        source: "owner_master",
      }),
      supabase.from("eligible_voters_snapshot").insert({
        meeting_id: closedMeeting!.id,
        room_id: closedRoom!.id,
        profile_id: profile!.id,
        voter_type: "owner",
        ownership_percent: 1,
        source: "owner_master",
      }),
    ]);

  expect(futureEligibilityError).toBeNull();
  expect(closedEligibilityError).toBeNull();

  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: demoAdminEmail,
      options: {
        redirectTo: `${appUrl}/auth/callback`,
      },
    });

  expect(linkError).toBeNull();
  expect(link.properties?.hashed_token).toBeTruthy();
  expect(link.properties?.verification_type).toBeTruthy();

  await page.goto(
    `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
      link.properties!.hashed_token,
    )}&type=${link.properties!.verification_type}`,
  );
  await expect(page).toHaveURL(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1):3000\/$/);
  const activeAppOrigin = appUrl;

  return {
    supabase,
    roomNumber,
    ownerName,
    meetingTitle,
    committeeName,
    questionText,
    choiceText,
    updatedChoiceText,
    futureMeetingTitle,
    closedMeetingTitle,
    manualAuditNote,
    documentSetKey,
    documentPath,
    startsAt,
    endsAt,
    profile,
    activeAppOrigin,
  };
}

export type AfterFixtures = Awaited<ReturnType<typeof fixtures>>;
