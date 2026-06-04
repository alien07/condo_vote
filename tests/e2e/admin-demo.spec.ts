import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const demoAdminEmail = "prajak.ma@gmail.com";
const demoAdminName = "Demo Admin";
const appUrl = "http://localhost:3000";

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
        const key = line.slice(0, separator).replace(/^export\s+/, "");
        const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");
        return [key, value];
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

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe("@test:e2e @test:auth @test:admin admin demo", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("demo admin can sign in and manage master data", async ({ page }) => {
    test.setTimeout(240_000);

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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();

    const { error: roleError } = await supabase.from("app_roles").upsert(
      {
        profile_id: profile!.id,
        role: "admin",
      },
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
    await page.goto(
      `${activeAppOrigin}/vote/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000`,
    );
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
    await page.goto(`${activeAppOrigin}/vote`);
    const futureVoteAssignment = page
      .getByRole("heading", { name: futureMeetingTitle })
      .locator("xpath=ancestor::section[1]");
    await expect(futureVoteAssignment.getByText("Not open yet")).toBeVisible();

    await page.goto(`${activeAppOrigin}/vote`);
    const closedVoteAssignment = page
      .getByRole("heading", { name: closedMeetingTitle })
      .locator("xpath=ancestor::section[1]");
    await expect(
      closedVoteAssignment.locator("span").filter({ hasText: "Closed" }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin`);
    await expect(
      page.getByRole("heading", { name: "Admin", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Master Data" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Voting Readiness" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Needs Attention" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Results & Communication" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Conflicts/ })).toHaveAttribute(
      "href",
      "/admin/voting",
    );
    await expect(page.getByRole("link", { name: /Queued mail/ })).toHaveAttribute(
      "href",
      "/admin/communications",
    );
    await expect(
      page.getByRole("link", { name: /Eligible voters/ }),
    ).toContainText(/% room coverage/);
    await page.goto(`${activeAppOrigin}/admin/people?tab=profiles`);
    await expect(
      page.getByRole("heading", { name: "Rooms & Owners", exact: true }),
    ).toBeVisible();
    const demoAdminRow = page
      .getByRole("row")
      .filter({ hasText: demoAdminEmail });
    await expect(
      demoAdminRow.getByRole("cell", { name: "owner", exact: true }),
    ).toBeVisible();
    await expect(
      demoAdminRow.getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible();
    await demoAdminRow.getByRole("link", { name: "Edit roles/status" }).click();
    const profileAccessDrawer = page.getByLabel("Edit roles/status");
    await profileAccessDrawer.locator('select[name="role"]').selectOption("committee");
    await profileAccessDrawer.getByRole("button", { name: "Save changes" }).click();
    await page.goto(`${activeAppOrigin}/admin/people?tab=profiles`);
    const roleDemoAdminRow = page
      .getByRole("row")
      .filter({ hasText: demoAdminEmail });
    await expect(
      roleDemoAdminRow.locator("td").nth(4).getByText("committee"),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/setup`);
    const juristicSection = page
      .getByRole("heading", { name: "Juristic Person" })
      .locator("xpath=ancestor::section[1]");
    await juristicSection
      .getByRole("textbox", { name: "Juristic person name" })
      .fill("Demo Juristic Person");
    await juristicSection
      .getByRole("textbox", { name: "Project name" })
      .fill("Demo Condo");
    await juristicSection
      .getByRole("textbox", { name: "Registration no." })
      .fill("REG-001");
    await juristicSection
      .getByRole("textbox", { name: "Juristic manager" })
      .fill("Demo Manager");
    await juristicSection
      .getByRole("button", { name: "Save juristic profile" })
      .click();
    await expect(juristicSection.locator('input[name="juristic_name"]')).toHaveValue(
      "Demo Juristic Person",
    );

    await page.goto(`${activeAppOrigin}/admin/setup?tab=storage`);
    const storageSection = page
      .getByRole("heading", { name: "Private Document Registry" })
      .locator("xpath=ancestor::section[1]");
    await storageSection
      .locator('select[name="document_storage_provider"]')
      .selectOption("local_drive");
    await storageSection
      .locator('input[name="document_storage_root"]')
      .fill("/private/condovotes-demo");
    await storageSection
      .getByRole("button", { name: "Save document storage config" })
      .click();
    await storageSection.getByRole("link", { name: "Register document" }).click();
    const registerDocumentDrawer = page.getByLabel("Register document");
    await registerDocumentDrawer.locator('input[name="owner_id"]').fill(profile!.id);
    await registerDocumentDrawer
      .locator('input[name="storage_path"]')
      .fill(documentPath);
    await registerDocumentDrawer
      .locator('input[name="document_set_key"]')
      .fill(documentSetKey);
    await registerDocumentDrawer
      .locator('input[name="original_filename"]')
      .fill(`${documentSetKey}.pdf`);
    await registerDocumentDrawer
      .locator('input[name="mime_type"]')
      .fill("application/pdf");
    await registerDocumentDrawer.locator('input[name="file_size_bytes"]').fill("123");
    await registerDocumentDrawer
      .locator('input[name="checksum_sha256"]')
      .fill("a".repeat(64));
    await registerDocumentDrawer.getByRole("button", { name: "Register document" }).click();
    await expect(
      storageSection.getByRole("cell", { name: `${documentSetKey} / v1` }),
    ).toBeVisible();
    await expect(
      storageSection.getByRole("cell", { name: documentPath }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/setup?tab=audit`);
    const auditSection = page
      .getByRole("heading", { name: "Business Audit Log" })
      .locator("xpath=ancestor::section[1]");
    await expect(
      auditSection.getByRole("cell", { name: "document.registered" }).first(),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/setup?tab=committee`);
    const committeeSection = page
      .getByRole("heading", { name: "Committee Members" })
      .locator("xpath=ancestor::section[1]");
    await committeeSection.getByRole("link", { name: "Add committee member" }).click();
    const addCommitteeDrawer = page.getByLabel("Add committee member");
    await addCommitteeDrawer.locator('input[name="full_name"]').fill(committeeName);
    await addCommitteeDrawer.locator('input[name="position_title"]').fill("Chairperson");
    await addCommitteeDrawer.getByRole("button", { name: "Add committee member" }).click();
    await expect(
      committeeSection.getByRole("cell", { name: committeeName }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/meetings`);
    await page.getByRole("link", { name: "Add meeting" }).click();
    const addMeetingDrawer = page.getByLabel("Add meeting");
    await addMeetingDrawer.locator('input[name="title"]').fill(meetingTitle);
    await addMeetingDrawer.getByPlaceholder("Meeting no.").fill("AGM-2026-001");
    await addMeetingDrawer.getByPlaceholder("Fiscal year").fill("2026");
    await addMeetingDrawer.getByPlaceholder("Location / platform").fill("Online");
    await addMeetingDrawer.getByPlaceholder("Chairperson").fill(committeeName);
    await addMeetingDrawer.locator('input[name="starts_at"]').fill(startsAt);
    await addMeetingDrawer.locator('input[name="ends_at"]').fill(endsAt);
    await addMeetingDrawer.getByRole("button", { name: "Add meeting" }).click();
    await expect(page.getByRole("cell", { name: meetingTitle })).toBeVisible();

    const questionsSection = page
      .getByRole("heading", { name: "Questions And Choices" })
      .locator("xpath=ancestor::section[1]");
    await questionsSection.getByRole("link", { name: "Add question" }).click();
    const addQuestionDrawer = page.getByLabel("Add question");
    await addQuestionDrawer
      .locator('select[name="meeting_id"]')
      .selectOption({ label: meetingTitle });
    await addQuestionDrawer.getByPlaceholder("Agenda no.").fill("1");
    await addQuestionDrawer.getByPlaceholder("Agenda title").fill("Approve demo agenda");
    await addQuestionDrawer.locator('input[name="question_text"]').fill(questionText);
    await addQuestionDrawer
      .locator('select[name="required_threshold"]')
      .selectOption("majority_submitted");
    await addQuestionDrawer.getByRole("button", { name: "Add question" }).click();
    await expect(
      questionsSection.getByRole("heading", { name: questionText }),
    ).toBeVisible();
    const questionCard = page
      .getByRole("heading", { name: questionText })
      .locator("xpath=ancestor::div[form[.//input[@name='question_id']]][1]");
    await questionCard.getByPlaceholder("Choice").fill(choiceText);
    await questionCard.getByRole("button", { name: "Add choice" }).click();
    await expect(
      questionCard.locator("span").filter({ hasText: choiceText }),
    ).toBeVisible();
    await questionCard.getByPlaceholder("Choice").fill(updatedChoiceText);
    await questionCard.getByRole("button", { name: "Add choice" }).click();
    await expect(
      questionCard.locator("span").filter({ hasText: updatedChoiceText }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/people?tab=rooms`);
    await page.getByRole("link", { name: "Add room" }).click();
    const addRoomDrawer = page.getByLabel("Add room");
    await addRoomDrawer.locator('input[name="room_number"]').fill(roomNumber);
    await addRoomDrawer.locator('input[name="ownership_percent"]').fill("1.25");
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(page.getByRole("cell", { name: roomNumber })).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/voting`);
    const manualVotesSection = page
      .getByRole("heading", { name: "Manual Votes" })
      .locator("xpath=ancestor::section[1]");
    await manualVotesSection.getByRole("link", { name: "Import manual vote" }).click();
    const importManualVoteDrawer = page.getByLabel("Import manual vote");
    await importManualVoteDrawer
      .locator('select[name="meeting_id"]')
      .selectOption({ label: meetingTitle });
    await importManualVoteDrawer
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
    await importManualVoteDrawer
      .locator('select[name="question_id"]')
      .selectOption({ label: `${meetingTitle} / 1 ${questionText}` });
    await importManualVoteDrawer
      .locator('select[name="choice_id"]')
      .selectOption({ label: `${questionText} / ${choiceText}` });
    await importManualVoteDrawer.getByPlaceholder("Source label").fill("Paper ballot");
    await importManualVoteDrawer.getByPlaceholder("Audit note").fill(manualAuditNote);
    await importManualVoteDrawer.getByRole("button", { name: "Import manual vote" }).click();
    await expect(
      manualVotesSection
        .getByRole("row")
        .filter({ hasText: roomNumber })
        .filter({ hasText: manualAuditNote }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/people?tab=owners`);
    await page.getByRole("link", { name: "Add owner" }).click();
    const addOwnerDrawer = page.getByLabel("Add owner");
    await addOwnerDrawer.locator('input[name="full_name"]').fill(ownerName);
    await addOwnerDrawer.locator('input[name="email"]').fill("owner.demo@example.com");
    await addOwnerDrawer.getByRole("button", { name: "Create owner" }).click();
    await expect(page.getByRole("cell", { name: ownerName })).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/ownership`);
    const roomOwnershipSection = page
      .getByRole("heading", { name: "Room Ownership" })
      .locator("xpath=ancestor::section[1]");
    await roomOwnershipSection.getByRole("link", { name: "Create ownership link" }).click();
    const createOwnershipDrawer = page.getByLabel("Create ownership link");
    await createOwnershipDrawer
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
    await createOwnershipDrawer
      .locator('select[name="owner_id"]')
      .selectOption({ label: ownerName });
    await createOwnershipDrawer.locator('input[name="starts_at"]').fill("2026-06-01");
    await createOwnershipDrawer.getByRole("button", { name: "Create ownership link" }).click();
    const roomOwnerRow = roomOwnershipSection
      .getByRole("row")
      .filter({ hasText: roomNumber })
      .filter({ hasText: ownerName });
    await expect(roomOwnerRow).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/proxies`);
    await page.getByRole("link", { name: "Add proxy authorization" }).click();
    const addProxyDrawer = page.getByLabel("Add proxy authorization");
    await addProxyDrawer
      .locator('select[name="meeting_id"]')
      .selectOption({ label: meetingTitle });
    await addProxyDrawer.locator('select[name="room_id"]').selectOption({
      label: roomNumber,
    });
    await addProxyDrawer
      .locator('select[name="owner_id"]')
      .selectOption({ label: ownerName });
    await addProxyDrawer
      .locator('select[name="proxy_profile_id"]')
      .selectOption({ label: `${demoAdminName} (${demoAdminEmail})` });
    await addProxyDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
    const proxyRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      proxyRow.getByRole("cell", { name: "pending", exact: true }),
    ).toBeVisible();
    await proxyRow.getByRole("link", { name: "Review" }).click();
    const reviewProxyDrawer = page.getByLabel("Review proxy authorization");
    await reviewProxyDrawer.locator('select[name="status"]').selectOption("approved");
    await reviewProxyDrawer.getByRole("button", { name: "Save review" }).click();
    await expect(
      proxyRow.getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/meetings`);
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
    await expect(voteCard.getByText("Review")).toBeVisible();
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

    await page.goto(`${activeAppOrigin}/admin/voting`);
    const conflictRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: roomNumber });
    await conflictRow.locator('select[name="chosen_source"]').selectOption("online");
    await conflictRow.getByPlaceholder("Conflict remark").fill("Use online demo vote");
    await conflictRow.getByRole("button", { name: "Resolve source" }).click();
    await expect(
      conflictRow.getByRole("cell", { name: "online", exact: true }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/meetings`);
    const publishedMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await publishedMeetingRow
      .getByRole("button", { name: "Generate result" })
      .click();
    await expect(
      publishedMeetingRow.getByRole("cell", { name: "closed", exact: true }),
    ).toBeVisible();
    await page.goto(voteDetailUrl);
    const closedVoteCard = page
      .getByRole("heading", { name: meetingTitle })
      .locator("xpath=ancestor::main[1]");
    await expect(closedVoteCard.getByText("Submitted v2")).toBeVisible();
    await expect(closedVoteCard.getByText("Closed")).toBeVisible();
    await expect(
      closedVoteCard.getByRole("button", { name: "Update ballot" }),
    ).toBeDisabled();

    await page.goto(`${activeAppOrigin}/admin/results`);
    const resultRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      resultRow.getByRole("cell", { name: "pending", exact: true }),
    ).toBeVisible();
    await resultRow.getByRole("link", { name: "Approve result" }).click();
    const approveResultDrawer = page.getByLabel("Approve result");
    await approveResultDrawer.getByRole("button", { name: "Approve result" }).click();
    await expect(
      resultRow.getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible();
    const pdfPreview = page.locator("#mock-pdf-summary");
    await expect(
      pdfPreview.getByRole("heading", { name: "Mock PDF Result Summary" }),
    ).toBeVisible();
    await expect(pdfPreview.getByText(meetingTitle)).toBeVisible();
    await expect(pdfPreview.getByText("Agenda Results")).toBeVisible();
    await expect(pdfPreview.getByText(updatedChoiceText)).toBeVisible();
    await expect(pdfPreview.getByText("Use online demo vote")).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/meetings`);
    const lockedMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await expect(lockedMeetingRow.getByText("Result locked")).toBeVisible();
    await expect(
      lockedMeetingRow.getByRole("button", { name: "Generate result" }),
    ).toHaveCount(0);
    await page.goto(`${activeAppOrigin}/admin/results`);
    const lockedResultRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await expect(
      lockedResultRow.getByRole("link", { name: "Approve result" }),
    ).toHaveCount(0);
    await page.goto(`${activeAppOrigin}/admin/communications`);
    await expect(page.getByText(/result_approved:/).first()).toBeVisible();
  });

  test("people CRUD pilot uses drawer actions and validation", async ({
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
        user_metadata: {
          full_name: demoAdminName,
        },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    expect(user).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      {
        profile_id: profile!.id,
        role: "admin",
      },
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    const pilotRoomNumber = `PILOT-${Date.now()}`;
    await page.goto(`${appUrl}/admin/people`);
    await expect(page).toHaveURL(/tab=rooms|\/admin\/people$/);
    await expect(
      page.getByRole("heading", { name: "Rooms", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add room" }).click();
    const addRoomDrawer = page.getByLabel("Add room");
    await expect(addRoomDrawer).toBeVisible();
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(
      addRoomDrawer.getByText("Please fix 2 fields before saving."),
    ).toBeVisible();
    await expect(addRoomDrawer.getByText("Room number is required.")).toBeVisible();
    await expect(addRoomDrawer.locator('input[name="room_number"]')).toBeFocused();
    await addRoomDrawer.locator('input[name="room_number"]').fill(pilotRoomNumber);
    await addRoomDrawer.locator('input[name="ownership_percent"]').fill("101");
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(
      addRoomDrawer.getByText("Ownership percentage must be between 0 and 100."),
    ).toBeVisible();
    await expect(addRoomDrawer.locator('input[name="room_number"]')).toHaveValue(
      pilotRoomNumber,
    );
    await expect(
      addRoomDrawer.locator('input[name="ownership_percent"]'),
    ).toHaveValue("101");
    await expect(
      addRoomDrawer.locator('input[name="ownership_percent"]'),
    ).toBeFocused();
    await addRoomDrawer.locator('input[name="ownership_percent"]').fill("1.5");
    await addRoomDrawer.getByRole("button", { name: "Create room" }).click();
    await expect(page.getByRole("cell", { name: pilotRoomNumber })).toBeVisible();

    const pilotRoomRow = page.getByRole("row").filter({ hasText: pilotRoomNumber });
    await pilotRoomRow.getByRole("link", { name: "Edit" }).click();
    const editRoomDrawer = page.getByLabel("Edit room");
    await expect(editRoomDrawer.getByText(`Room: ${pilotRoomNumber}`)).toBeVisible();
    await expect(pilotRoomRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
    await editRoomDrawer.getByRole("link", { name: "Cancel" }).click();
    await expect(editRoomDrawer).toHaveCount(0);
    await expect(page).toHaveURL(/tab=rooms/);

    await page.goto(`${appUrl}/admin/people?tab=profiles`);
    const profileRow = page.getByRole("row").filter({ hasText: demoAdminEmail });
    await profileRow.getByRole("link", { name: "Edit roles/status" }).click();
    await expect(page.getByLabel("Edit roles/status")).toBeVisible();
    await page.getByLabel("Close drawer").click();
    await expect(page).toHaveURL(/tab=profiles/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appUrl}/admin/people?tab=owners`);
    await expect(page.getByRole("heading", { name: "Owners" })).toBeVisible();
    await page.getByRole("link", { name: "Add owner" }).click();
    const addOwnerMobileDrawer = page.getByLabel("Add owner");
    await expect(addOwnerMobileDrawer).toBeVisible();
    const drawerWidth = await addOwnerMobileDrawer.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    const viewportWidth = page.viewportSize()?.width ?? 390;
    expect(drawerWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

async function findUserByEmail(
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    expect(error).toBeNull();

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (found || data.users.length < 100) {
      return found ?? null;
    }

    page += 1;
  }
}
