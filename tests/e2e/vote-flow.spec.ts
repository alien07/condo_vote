import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const appUrl = "http://127.0.0.1:3000";

function readLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).replace(/^export\s+/, ""),
          line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  localEnv.SUPABASE_SECRET_KEY ||
  localEnv.SUPABASE_SERVICE_ROLE_KEY;

type VoterType = "owner" | "proxy";
type SupabaseAdmin = ReturnType<typeof createClient<Database>>;

async function createProfile(supabase: SupabaseAdmin, voterType: VoterType) {
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${voterType}-vote-${timestamp}@example.local`;
  const fullName = `${voterType} vote ${timestamp}`;
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  expect(userError).toBeNull();
  expect(userData.user).toBeTruthy();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: userData.user!.id,
      email,
      full_name: fullName,
      approval_status: "approved",
      default_status: voterType,
    })
    .select("id")
    .single();

  expect(profileError).toBeNull();

  return {
    email,
    profileId: profile!.id,
  };
}

async function createVotingFixture(
  supabase: SupabaseAdmin,
  voterType: VoterType,
  profileId: string,
) {
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const startsAt = new Date(now - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 60 * 60 * 1000).toISOString();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      room_number: `${voterType.toUpperCase()}-${timestamp}`,
      ownership_percent: 1,
      active: true,
    })
    .select("id, room_number")
    .single();

  expect(roomError).toBeNull();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      title: `${voterType} vote flow ${timestamp}`,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "published",
      published_at: new Date().toISOString(),
      meeting_type: "online_vote",
      quorum_rule: "one_fourth_total_ownership",
    })
    .select("id, title")
    .single();

  expect(meetingError).toBeNull();

  const { data: question, error: questionError } = await supabase
    .from("meeting_questions")
    .insert({
      meeting_id: meeting!.id,
      agenda_no: "1",
      agenda_title: "Vote flow",
      question_text: "Approve the test resolution?",
      question_type: "single_choice",
      resolution_type: "ordinary",
      required_threshold: "majority_submitted",
      display_order: 1,
      required: true,
    })
    .select("id")
    .single();

  expect(questionError).toBeNull();

  const { data: choices, error: choicesError } = await supabase
    .from("meeting_choices")
    .insert([
      {
        question_id: question!.id,
        choice_text: "Approve",
        display_order: 1,
      },
      {
        question_id: question!.id,
        choice_text: "Reject",
        display_order: 2,
      },
    ])
    .select("id, choice_text");

  expect(choicesError).toBeNull();

  const { error: eligibleError } = await supabase
    .from("eligible_voters_snapshot")
    .insert({
      meeting_id: meeting!.id,
      room_id: room!.id,
      profile_id: profileId,
      voter_type: voterType,
      ownership_percent: 1,
      source: voterType === "owner" ? "owner_master" : "proxy_authorization",
    });

  expect(eligibleError).toBeNull();

  return {
    approveChoiceId: choices!.find((choice) => choice.choice_text === "Approve")!
      .id,
    meetingId: meeting!.id,
    meetingTitle: meeting!.title,
    questionId: question!.id,
    rejectChoiceId: choices!.find((choice) => choice.choice_text === "Reject")!
      .id,
    roomId: room!.id,
    roomNumber: room!.room_number,
  };
}

async function signInByGeneratedLink(
  page: Page,
  supabase: SupabaseAdmin,
  email: string,
) {
  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
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
}

test.describe("@test:e2e @test:voting owner/proxy vote flow", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for vote flow integration.",
  );

  for (const voterType of ["owner", "proxy"] as const) {
    test(`${voterType} can submit and edit a ballot`, async ({ page }) => {
      test.setTimeout(120_000);

      const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const profile = await createProfile(supabase, voterType);
      const fixture = await createVotingFixture(
        supabase,
        voterType,
        profile.profileId,
      );

      await signInByGeneratedLink(page, supabase, profile.email);

      await page.goto("/vote");
      await expect(
        page.getByRole("heading", { exact: true, name: "Vote" }),
      ).toBeVisible();
      await expect(page.getByText(fixture.meetingTitle)).toBeVisible();
      await expect(
        page.getByText(
          `Room ${fixture.roomNumber} / ${voterType} / ownership 1%`,
        ),
      ).toBeVisible();

      await page.getByRole("link", { name: "Open ballot" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/vote/${fixture.meetingId}/${fixture.roomId}$`),
      );
      await expect(
        page.getByRole("heading", { name: fixture.meetingTitle }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { exact: true, name: "Back" }),
      ).toHaveAttribute("href", "/vote");
      await expect(page.getByRole("link", { name: "Ballot" })).toBeVisible();

      await page
        .locator(`input[name="choice:${fixture.questionId}"]`)
        .and(page.locator(`input[value="${fixture.approveChoiceId}"]`))
        .check();
      await page.getByRole("button", { name: "Submit ballot" }).click();
      await expect(page.getByText("Version v1")).toBeVisible();
      await expect(page.getByText("Approve").last()).toBeVisible();

      await page
        .locator(`input[name="choice:${fixture.questionId}"]`)
        .and(page.locator(`input[value="${fixture.rejectChoiceId}"]`))
        .check();
      await page.getByRole("button", { name: "Update ballot" }).click();
      await expect(page.getByText("Version v2")).toBeVisible();
      await expect(page.getByText("Reject").last()).toBeVisible();

      const { data: ballot, error: ballotError } = await supabase
        .from("ballots")
        .select("id, status, version_number, ballot_answers(choice_id), ballot_versions(version_number)")
        .eq("meeting_id", fixture.meetingId)
        .eq("room_id", fixture.roomId)
        .eq("voter_profile_id", profile.profileId)
        .single();

      expect(ballotError).toBeNull();
      expect(ballot!.status).toBe("submitted");
      expect(ballot!.version_number).toBe(2);
      expect(ballot!.ballot_answers[0]?.choice_id).toBe(fixture.rejectChoiceId);
      expect(ballot!.ballot_versions.map((version) => version.version_number).sort()).toEqual([
        1,
        2,
      ]);

      const { data: auditLogs, error: auditError } = await supabase
        .from("audit_logs")
        .select("action")
        .eq("entity_type", "ballot")
        .eq("entity_id", ballot!.id);

      expect(auditError).toBeNull();
      expect(auditLogs!.map((log) => log.action).sort()).toEqual([
        "ballot.submitted",
        "ballot.updated",
      ]);
    });
  }
});
