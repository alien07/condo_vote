import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
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
  date.setMinutes(Math.floor(date.getMinutes() / 10) * 10, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function gotoWithRetry(
  page: Page,
  url: string,
  options: Parameters<Page["goto"]>[1] = { waitUntil: "commit" },
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      await page.waitForTimeout(1_000 * attempt);
    }
  }
}

test.describe("@test:e2e @test:auth @test:admin admin demo", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("demo admin can sign in and manage master data", async ({ page }) => {
    test.setTimeout(900_000);

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
    const profileAccessDrawer = page.getByRole("complementary", {
      name: "Edit roles/status",
    });
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
      .getByRole("heading", { name: "Document Storage" })
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
    await storageSection.getByRole("link", { name: "Open Documents" }).click();
    await page.getByRole("link", { name: "Register document" }).click();
    const registerDocumentDrawer = page.getByRole("complementary", {
      name: "Register document",
    });
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
      page.getByRole("cell", { name: `${documentSetKey} / v1` }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: documentPath }),
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
    await page.waitForURL(/\/admin\/setup\?[\s\S]*memberName=/, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("cell", { name: committeeName }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto(
      `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
    );
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
    await page.waitForURL(/\/admin\/meetings\?[\s\S]*focusMeetingId=/, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("cell", { name: meetingTitle })).toBeVisible();
    await page.goto(`${activeAppOrigin}/admin/meetings?tab=questions`);

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
      .locator("xpath=ancestor::*[.//input[@name='question_id']][1]");
    await questionCard.getByRole("textbox", { name: "Choice" }).fill(choiceText);
    await questionCard.getByRole("button", { name: "Add choice" }).click();
    await expect(
      questionCard.getByRole("button", { name: "Add choice" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      questionCard.locator("span").filter({ hasText: choiceText }),
    ).toBeVisible({ timeout: 15_000 });
    await questionCard
      .getByRole("textbox", { name: "Choice" })
      .fill(updatedChoiceText);
    await questionCard.getByRole("button", { name: "Add choice" }).click();
    await expect(
      questionCard.getByRole("button", { name: "Add choice" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      questionCard.locator("span").filter({ hasText: updatedChoiceText }),
    ).toBeVisible({ timeout: 15_000 });

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
    await importManualVoteDrawer
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
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
    await createOwnershipDrawer
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
    await createOwnershipDrawer
      .locator('select[name="owner_id"]')
      .selectOption({ label: ownerName });
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

    await gotoWithRetry(page, `${activeAppOrigin}/admin/proxies`, {
      waitUntil: "commit",
    });
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
    await page.waitForTimeout(1_000);
    await gotoWithRetry(
      page,
      `${activeAppOrigin}/admin/proxies?meeting=${encodeURIComponent(meetingTitle)}`,
      { waitUntil: "commit" },
    );
    const proxyRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      proxyRow.getByRole("cell", { name: "pending", exact: true }),
    ).toBeVisible();
    const proxyReviewHref = await proxyRow
      .getByRole("link", { name: "Review" })
      .getAttribute("href");
    expect(proxyReviewHref).toBeTruthy();
    await gotoWithRetry(page, new URL(proxyReviewHref ?? "", activeAppOrigin).toString(), {
      waitUntil: "commit",
    });
    const reviewProxyDrawer = page.getByRole("complementary", {
      name: "Review proxy authorization",
    });
    await expect(reviewProxyDrawer).toBeVisible({ timeout: 15_000 });
    await reviewProxyDrawer.locator('select[name="status"]').selectOption("approved");
    page.once("dialog", async (dialog) => {
      await dialog.accept().catch(() => undefined);
    });
    await reviewProxyDrawer.getByRole("button", { name: "Save review" }).click();
    await page.waitForTimeout(1_000);
    await gotoWithRetry(
      page,
      `${activeAppOrigin}/admin/proxies?meeting=${encodeURIComponent(meetingTitle)}`,
      { waitUntil: "commit" },
    );
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

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

    await page.goto(
      `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
    );
    const pendingMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await expect(
      pendingMeetingRow.getByRole("link", { name: /Resolve 1 pending manual vote/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      pendingMeetingRow.getByRole("button", { name: "Generate result" }),
    ).toHaveCount(0);

    await page.goto(`${activeAppOrigin}/admin/voting`);
    const pendingManualVoteRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: roomNumber });
    await pendingManualVoteRow.getByRole("link", { name: "Link profile" }).click();
    const resolveIdentityDrawer = page.getByRole("complementary", {
      name: "Resolve manual vote identity",
    });
    await expect(resolveIdentityDrawer).toBeVisible({ timeout: 15_000 });
    await resolveIdentityDrawer
      .locator('select[name="voter_profile_id"]')
      .selectOption({ label: `${demoAdminName} (${demoAdminEmail})` });
    page.once("dialog", async (dialog) => {
      await dialog.accept().catch(() => undefined);
    });
    await resolveIdentityDrawer.getByRole("button", { name: "Link profile" }).click();
    await page.waitForURL("**/admin/voting", { waitUntil: "domcontentloaded" });

    await page.goto(
      `${activeAppOrigin}/admin/voting/conflicts?meeting=${encodeURIComponent(
        meetingTitle,
      )}&room=${encodeURIComponent(roomNumber)}`,
    );
    const conflictRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: roomNumber });
    await conflictRow.getByRole("button", { name: "Review / Resolve" }).click();
    const reviewConflictDialog = page.getByRole("dialog", {
      name: "Review vote source conflict",
    });
    await reviewConflictDialog
      .locator('select[name="chosen_source"]')
      .selectOption("online");
    await reviewConflictDialog
      .getByPlaceholder("Explain why this source is selected.")
      .fill("Use online demo vote");
    await reviewConflictDialog.getByRole("button", { name: "Resolve source" }).click();
    await page.waitForURL("**/admin/voting/conflicts?feedback=success**", {
      waitUntil: "domcontentloaded",
    });
    await page.goto(
      `${activeAppOrigin}/admin/voting/conflicts?meeting=${encodeURIComponent(
        meetingTitle,
      )}&room=${encodeURIComponent(roomNumber)}`,
    );
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .filter({ hasText: roomNumber })
        .getByRole("cell", { name: "resolved", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto(
      `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
    );
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

    await gotoWithRetry(
      page,
      `${activeAppOrigin}/admin/results?meeting=${encodeURIComponent(meetingTitle)}`,
      { waitUntil: "commit" },
    );
    const resultRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      resultRow.getByRole("cell", { name: "pending", exact: true }),
    ).toBeVisible();
    await resultRow.getByRole("link", { name: "Approve result" }).click();
    const approveResultDrawer = page.getByLabel("Approve result");
    page.once("dialog", async (dialog) => {
      await dialog.accept().catch(() => undefined);
    });
    await approveResultDrawer.getByRole("button", { name: "Approve result" }).click();
    await page.waitForURL("**/admin/results?feedback=success**", {
      waitUntil: "commit",
    });
    await gotoWithRetry(
      page,
      `${activeAppOrigin}/admin/results?meeting=${encodeURIComponent(meetingTitle)}`,
      { waitUntil: "commit" },
    );
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const pdfPreview = page.locator("#mock-pdf-summary");
    await expect(
      pdfPreview.getByRole("heading", { name: "Mock PDF Result Summary" }),
    ).toBeVisible();
    await expect(pdfPreview.getByText(meetingTitle)).toBeVisible();
    await expect(pdfPreview.getByText("Agenda Results")).toBeVisible();
    await expect(pdfPreview.getByText(updatedChoiceText)).toBeVisible();
    await expect(pdfPreview.getByText("Use online demo vote")).toBeVisible();

    await page.goto(
      `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
    );
    const lockedMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await expect(lockedMeetingRow.getByText("Result locked")).toBeVisible();
    await expect(
      lockedMeetingRow.getByRole("button", { name: "Generate result" }),
    ).toHaveCount(0);
    await gotoWithRetry(
      page,
      `${activeAppOrigin}/admin/results?meeting=${encodeURIComponent(meetingTitle)}`,
      { waitUntil: "commit" },
    );
    const lockedResultRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await expect(
      lockedResultRow.getByRole("link", { name: "Approve result" }),
    ).toHaveCount(0);
    await gotoWithRetry(page, `${activeAppOrigin}/admin/communications`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("heading", { name: "Communications" }),
    ).toBeVisible();
    await expect(page.getByText(/result_approved:/).first()).toBeVisible();
  });

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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
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
      await expect(
        publishedRow.getByRole("button", { name: "Generate result" }),
      ).toBeVisible();
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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
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

  test("committee CRUD rollout preserves state and supports status actions", async ({
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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
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
    const memberName = `Committee rollout ${stamp}`;
    const updatedPosition = `Vice chair ${stamp}`;

    try {
      await page.goto(
        `${appUrl}/admin/setup?tab=committee&sort=name&dir=desc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add committee member" }).click();
      const addDrawer = page.getByRole("complementary", {
        name: "Add committee member",
      });

      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Committee name is required.")).toBeVisible();
      await expect(addDrawer.getByText("Position is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toBeFocused();

      await addDrawer.locator('input[name="full_name"]').fill(memberName);
      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await expect(addDrawer.getByText("Position is required.")).toBeVisible();
      await expect(addDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await expect(
        addDrawer.locator('input[name="position_title"]'),
      ).toBeFocused();

      await addDrawer.locator('input[name="position_title"]').fill("Chairperson");
      await addDrawer
        .getByRole("button", { name: "Add committee member" })
        .click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusCommitteeId")));

      const memberId = new URL(page.url()).searchParams.get("focusCommitteeId");

      expect(memberId).toBeTruthy();
      await expect(page).toHaveURL(/sort=name/);
      await expect(page).toHaveURL(/dir=desc/);
      await expect(page).toHaveURL(/perPage=25/);

      const memberRow = page.locator(
        `tr[data-committee-id="${memberId}"]:visible`,
      );

      await expect(memberRow).toBeVisible();
      await expect(memberRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(
        memberRow.getByRole("button", { name: "Deactivate" }),
      ).toBeVisible();
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-committee-id") === id,
        memberId,
      );

      await memberRow.getByRole("link", { name: "Edit" }).click();
      const editDrawer = page.getByRole("complementary", {
        name: "Edit committee member",
      });

      await expect(editDrawer).toBeVisible({ timeout: 15_000 });
      await expect(editDrawer.locator('input[name="full_name"]')).toHaveValue(
        memberName,
      );
      await editDrawer
        .locator('input[name="position_title"]')
        .fill(updatedPosition);
      await editDrawer
        .getByRole("button", { name: "Save committee member" })
        .click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("focusCommitteeId") === memberId &&
          !url.searchParams.has("mode"),
      );
      await expect(memberRow.getByRole("cell", { name: updatedPosition })).toBeVisible();
      await expect(memberRow).toHaveClass(/border-l-\[var\(--primary\)\]/);

      page.once("dialog", (dialog) => dialog.accept());
      await memberRow.getByRole("button", { name: "Deactivate" }).click();
      await expect(
        memberRow.getByRole("button", { name: "Reactivate" }),
      ).toBeVisible({ timeout: 15_000 });

      page.once("dialog", (dialog) => dialog.accept());
      await memberRow.getByRole("button", { name: "Reactivate" }).click();
      await expect(
        memberRow.getByRole("button", { name: "Deactivate" }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await supabase.from("committee_members").delete().eq("full_name", memberName);
    }
  });

  test("storage document rollout validates and focuses registered documents", async ({
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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
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
    const documentSet = `storage-rollout-${stamp}`;
    const storagePath = `/private/storage-rollout-${stamp}.pdf`;
    let documentId: string | null = null;

    try {
      await page.goto(`${appUrl}/admin/setup?tab=storage`);
      const storageSection = page
        .getByRole("heading", { name: "Document Storage" })
        .locator("xpath=ancestor::section[1]");

      await expect(
        storageSection.getByRole("button", {
          name: "Save document storage config",
        }),
      ).toBeVisible();
      await storageSection.getByRole("link", { name: "Open Documents" }).click();
      await expect(page).toHaveURL(/\/admin\/documents/);

      await page.goto(
        `${appUrl}/admin/documents?sort=set&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Register document" }).click();
      const drawer = page.getByRole("complementary", {
        name: "Register document",
      });

      await drawer.getByRole("button", { name: "Register document" }).click();
      await expect(drawer.getByText("Owner UUID is required.")).toBeVisible();
      await expect(drawer.getByText("Path or link is required.")).toBeVisible();
      await expect(drawer.getByText("Document set key is required.")).toBeVisible();
      await expect(drawer.locator('input[name="owner_id"]')).toBeFocused();

      await drawer.locator('input[name="owner_id"]').fill("invalid-owner-id");
      await drawer.locator('input[name="storage_path"]').fill(storagePath);
      await drawer.locator('input[name="document_set_key"]').fill(documentSet);
      await drawer.getByRole("button", { name: "Register document" }).click();
      await expect(drawer.getByText("Owner UUID must be a valid UUID.")).toBeVisible();
      await expect(drawer.locator('input[name="storage_path"]')).toHaveValue(
        storagePath,
      );
      await expect(drawer.locator('input[name="document_set_key"]')).toHaveValue(
        documentSet,
      );
      await expect(drawer.locator('input[name="owner_id"]')).toBeFocused();

      await drawer.locator('input[name="owner_id"]').fill(profile!.id);
      await drawer.getByRole("button", { name: "Register document" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusDocumentId")));

      documentId = new URL(page.url()).searchParams.get("focusDocumentId");
      expect(documentId).toBeTruthy();
      await expect(page).toHaveURL(/sort=set/);
      await expect(page).toHaveURL(/dir=asc/);
      await expect(page).toHaveURL(/perPage=25/);
      await expect(page).toHaveURL(new RegExp(`set=${documentSet}`));

      const documentRow = page.locator(
        `tr[data-document-id="${documentId}"]:visible`,
      );

      await expect(documentRow).toBeVisible();
      await expect(documentRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
      await expect(documentRow).toContainText(documentSet);
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-document-id") === id,
        documentId,
      );
    } finally {
      if (documentId) {
        await supabase.from("audit_logs").delete().eq("entity_id", documentId);
        await supabase.from("documents").delete().eq("id", documentId);
      } else {
        await supabase.from("documents").delete().eq("document_set_key", documentSet);
      }
    }
  });

  test("proxy CRUD rollout validates and focuses reviewed rows", async ({
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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const stamp = Date.now();
    const meetingTitle = `Proxy rollout ${stamp}`;
    const roomNumber = `PROXY-${stamp}`;
    const ownerName = `Proxy Owner ${stamp}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let proxyId: string | null = null;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .insert({
        active: true,
        email: `proxy-owner-${stamp}@example.com`,
        full_name: ownerName,
      })
      .select("id")
      .single();

    expect(ownerError).toBeNull();
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
        `${appUrl}/admin/proxies?meeting=${encodeURIComponent(
          meetingTitle,
        )}&sort=meeting&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add proxy authorization" }).click();
      const addDrawer = page.getByRole("complementary", {
        name: "Add proxy authorization",
      });

      await addDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
      await expect(addDrawer.getByText("Meeting is required.")).toBeVisible();
      await expect(addDrawer.locator('select[name="meeting_id"]')).toBeFocused();

      await addDrawer
        .locator('select[name="meeting_id"]')
        .selectOption({ label: meetingTitle });
      await addDrawer
        .locator('select[name="room_id"]')
        .selectOption({ label: roomNumber });
      await addDrawer
        .locator('select[name="owner_id"]')
        .selectOption({ label: ownerName });
      await addDrawer
        .locator('select[name="proxy_profile_id"]')
        .selectOption({ label: `${demoAdminName} (${demoAdminEmail})` });
      await addDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusProxyId")));

      proxyId = new URL(page.url()).searchParams.get("focusProxyId");
      expect(proxyId).toBeTruthy();
      await expect(page).toHaveURL(/sort=meeting/);
      await expect(page).toHaveURL(/dir=asc/);
      await expect(page).toHaveURL(/perPage=25/);

      const proxyRow = page.locator(`tr[data-proxy-id="${proxyId}"]:visible`);

      await expect(proxyRow).toBeVisible();
      await expect(proxyRow).toContainText(meetingTitle);
      await expect(proxyRow).toContainText("pending");

      await proxyRow.getByRole("link", { name: "Review" }).click();
      const reviewDrawer = page.getByRole("complementary", {
        name: "Review proxy authorization",
      });

      await reviewDrawer.locator('select[name="status"]').selectOption("approved");
      page.once("dialog", (dialog) => dialog.accept());
      await reviewDrawer.getByRole("button", { name: "Save review" }).click();
      await page.waitForURL((url) => url.searchParams.get("focusProxyId") === proxyId);
      await expect(proxyRow).toContainText("approved", { timeout: 15_000 });
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-proxy-id") === id,
        proxyId,
      );
    } finally {
      if (proxyId) {
        await supabase.from("audit_logs").delete().eq("entity_id", proxyId);
        await supabase.from("proxy_authorizations").delete().eq("id", proxyId);
      }

      if (meeting?.id) {
        await supabase.from("meetings").delete().eq("id", meeting.id);
      }

      if (owner?.id) {
        await supabase.from("owners").delete().eq("id", owner.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }
    }
  });

  test("ownership CRUD rollout validates and focuses saved rows", async ({
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
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      { profile_id: profile!.id, role: "admin" },
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const stamp = Date.now();
    const roomNumber = `OWN-${stamp}`;
    const ownerName = `Ownership Owner ${stamp}`;
    let ownershipId: string | null = null;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .insert({
        active: true,
        email: `ownership-owner-${stamp}@example.com`,
        full_name: ownerName,
      })
      .select("id")
      .single();

    expect(ownerError).toBeNull();
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
        `${appUrl}/admin/ownership?room=${encodeURIComponent(
          roomNumber,
        )}&status=all&sort=room&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Create ownership link" }).click();
      const createDrawer = page.getByRole("complementary", {
        name: "Create ownership link",
      });

      await createDrawer.getByRole("button", { name: "Create ownership link" }).click();
      await expect(createDrawer.getByText("Room is required.")).toBeVisible();
      await expect(createDrawer.getByText("Owner is required.")).toBeVisible();
      await expect(createDrawer.locator('select[name="room_id"]')).toBeFocused();

      await createDrawer
        .locator('select[name="room_id"]')
        .selectOption({ label: roomNumber });
      await createDrawer
        .locator('select[name="owner_id"]')
        .selectOption({ label: ownerName });
      await createDrawer.getByRole("button", { name: "Create ownership link" }).click();
      await page.waitForURL((url) =>
        Boolean(url.searchParams.get("focusOwnershipId")),
      );

      ownershipId = new URL(page.url()).searchParams.get("focusOwnershipId");
      expect(ownershipId).toBeTruthy();
      await expect(page).toHaveURL(/status=all/);
      await expect(page).toHaveURL(/sort=room/);
      await expect(page).toHaveURL(/perPage=25/);

      const ownershipRow = page.locator(
        `tr[data-ownership-id="${ownershipId}"]:visible`,
      );

      await expect(ownershipRow).toBeVisible();
      await expect(ownershipRow).toContainText(roomNumber);
      await expect(ownershipRow).toContainText(ownerName);
      await expect(ownershipRow).toHaveClass(/border-l-\[var\(--primary\)\]/);

      await ownershipRow.getByRole("link", { name: "Edit dates" }).click();
      const editDrawer = page.getByRole("complementary", {
        name: "Edit ownership dates",
      });

      await editDrawer.locator('input[name="starts_at"]').fill(yesterday);
      await editDrawer.getByRole("button", { name: "Save dates" }).click();
      await expect(ownershipRow).toContainText(yesterday, { timeout: 15_000 });

      await ownershipRow.getByRole("link", { name: "End Link" }).click();
      const endDrawer = page.getByRole("complementary", {
        name: "End ownership link",
      });

      await endDrawer.locator('input[name="ends_at"]').fill(yesterday);
      page.once("dialog", (dialog) => dialog.accept());
      await endDrawer.getByRole("button", { name: "End Link" }).click();
      await expect(ownershipRow).toContainText("Ended", { timeout: 15_000 });
    } finally {
      if (ownershipId) {
        await supabase.from("audit_logs").delete().eq("entity_id", ownershipId);
        await supabase.from("room_owners").delete().eq("id", ownershipId);
      }

      if (owner?.id) {
        await supabase.from("owners").delete().eq("id", owner.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }
    }
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
    const addRoomDrawer = page.getByRole("complementary", { name: "Add room" });
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
    await page.waitForURL("**/admin/people?tab=rooms&feedback=success**", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("cell", { name: pilotRoomNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const pilotRoomRow = page.getByRole("row").filter({ hasText: pilotRoomNumber });
    await pilotRoomRow.getByRole("link", { name: "Edit" }).click();
    const editRoomDrawer = page.getByRole("complementary", { name: "Edit room" });
    await expect(editRoomDrawer.getByText(`Room: ${pilotRoomNumber}`)).toBeVisible();
    await expect(pilotRoomRow).toHaveClass(/border-l-\[var\(--primary\)\]/);
    await editRoomDrawer.getByRole("link", { name: "Cancel" }).click();
    await expect(editRoomDrawer).toHaveCount(0);
    await expect(page).toHaveURL(/tab=rooms/);

    await page.goto(`${appUrl}/admin/people?tab=profiles`);
    const profileRow = page.getByRole("row").filter({ hasText: demoAdminEmail });
    await profileRow.getByRole("link", { name: "Edit roles/status" }).click();
    await expect(
      page.getByRole("complementary", { name: "Edit roles/status" }),
    ).toBeVisible();
    await page.getByLabel("Close drawer").click();
    await expect(page).toHaveURL(/tab=profiles/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appUrl}/admin/people?tab=owners`);
    await expect(
      page.getByRole("heading", { exact: true, name: "Owners" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add owner" }).click();
    const addOwnerMobileDrawer = page.getByRole("complementary", {
      name: "Add owner",
    });
    await expect(addOwnerMobileDrawer).toBeVisible();
    const drawerWidth = await addOwnerMobileDrawer.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    const viewportWidth = page.viewportSize()?.width ?? 390;
    expect(drawerWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test("pending manual vote identity blocks results until linked", async ({
    page,
  }) => {
    test.setTimeout(160_000);

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
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          email: demoAdminEmail,
          full_name: demoAdminName,
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

    const runId = Date.now();
    const meetingTitle = `Pending Identity Meeting ${runId}`;
    const roomNumber = `PENDING-${runId}`;
    const questionText = `Pending identity item ${runId}?`;
    const choiceText = `Approve pending ${runId}`;
    const pendingIdentity = `Paper voter ${runId}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
        meeting_id: meeting!.id,
        question_text: questionText,
      })
      .select("id")
      .single();

    expect(questionError).toBeNull();

    const { data: choice, error: choiceError } = await supabase
      .from("meeting_choices")
      .insert({
        choice_text: choiceText,
        question_id: question!.id,
      })
      .select("id")
      .single();

    expect(choiceError).toBeNull();

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

    const { data: pendingManualBallot, error: pendingManualBallotError } =
      await supabase
        .from("manual_ballots")
        .insert({
          identity_status: "pending",
          imported_by: profile!.id,
          meeting_id: meeting!.id,
          room_id: room!.id,
          source_label: "manual_pending_identity",
          status: "draft",
          voter_identity_text: pendingIdentity,
        })
        .select("id")
        .single();

    expect(pendingManualBallotError).toBeNull();

    const { error: answerError } = await supabase
      .from("manual_ballot_answers")
      .insert({
        choice_id: choice!.id,
        manual_ballot_id: pendingManualBallot!.id,
        question_id: question!.id,
      });

    expect(answerError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
        type: "magiclink",
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    await page.goto(
      `${appUrl}/admin/meetings?tab=meetings&title=${encodeURIComponent(
        meetingTitle,
      )}`,
      { waitUntil: "domcontentloaded" },
    );
    const meetingRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      meetingRow.getByRole("link", { name: /Resolve 1 pending manual vote/ }),
    ).toBeVisible();
    await expect(
      meetingRow.getByRole("button", { name: "Generate result" }),
    ).toHaveCount(0);

    await page.goto(`${appUrl}/admin/voting`);
    const pendingPanel = page
      .getByRole("heading", { name: "Pending manual vote identities" })
      .locator("xpath=ancestor::section[1]");
    const pendingRow = pendingPanel
      .getByRole("row")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: pendingIdentity });

    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("link", { name: "Link profile" }).click();
    const resolveDrawer = page.getByLabel("Resolve manual vote identity");
    await resolveDrawer
      .locator('select[name="voter_profile_id"]')
      .selectOption(profile!.id);
    page.once("dialog", (dialog) => dialog.accept());
    await resolveDrawer.getByRole("button", { name: "Link profile" }).click();

    await expect(pendingPanel.getByRole("row").filter({ hasText: meetingTitle })).toHaveCount(0);

    const { data: resolvedManualBallot, error: resolvedManualBallotError } =
      await supabase
        .from("manual_ballots")
        .select("identity_status, status, voter_profile_id")
        .eq("id", pendingManualBallot!.id)
        .single();

    expect(resolvedManualBallotError).toBeNull();
    expect(resolvedManualBallot).toMatchObject({
      identity_status: "linked",
      status: "submitted",
      voter_profile_id: profile!.id,
    });

    const { data: identityAuditLogs, error: identityAuditError } = await supabase
      .from("audit_logs")
      .select("action")
      .eq("entity_id", pendingManualBallot!.id)
      .eq("action", "manual_ballot.identity_resolved");

    expect(identityAuditError).toBeNull();
    expect(identityAuditLogs).toHaveLength(1);

    await page.goto(
      `${appUrl}/admin/meetings?tab=meetings&title=${encodeURIComponent(
        meetingTitle,
      )}`,
    );
    const resolvedMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await resolvedMeetingRow
      .getByRole("button", { name: "Generate result" })
      .click();
    await expect(
      resolvedMeetingRow.getByRole("cell", { name: "closed", exact: true }),
    ).toBeVisible();

    const { data: generatedSnapshot, error: generatedSnapshotError } =
      await supabase
        .from("result_snapshots")
        .select("id")
        .eq("meeting_id", meeting!.id)
        .single();

    expect(generatedSnapshotError).toBeNull();
    expect(generatedSnapshot?.id).toBeTruthy();

    const approvalBlockTitle = `Approval Block Meeting ${runId}`;
    const approvalBlockRoomNumber = `APPROVAL-BLOCK-${runId}`;
    const approvalBlockIdentity = `Approval blocker ${runId}`;
    const [{ data: approvalBlockRoom }, { data: approvalBlockMeeting }] =
      await Promise.all([
        supabase
          .from("rooms")
          .insert({ ownership_percent: 1, room_number: approvalBlockRoomNumber })
          .select("id")
          .single(),
        supabase
          .from("meetings")
          .insert({
            ends_at: endsAt,
            published_at: new Date().toISOString(),
            starts_at: startsAt,
            status: "closed",
            title: approvalBlockTitle,
          })
          .select("id")
          .single(),
      ]);

    expect(approvalBlockRoom).toBeTruthy();
    expect(approvalBlockMeeting).toBeTruthy();

    const { data: approvalBlockSnapshot, error: approvalBlockSnapshotError } =
      await supabase
        .from("result_snapshots")
        .insert({
          generated_by: profile!.id,
          meeting_id: approvalBlockMeeting!.id,
          payload_json: {
            generated_at: new Date().toISOString(),
            meeting: { title: approvalBlockTitle },
            questions: [],
            totals: {
              eligible_voters: 1,
              manual_ballots: 0,
              online_ballots: 0,
              source_conflicts: 0,
              submitted_ballots: 0,
            },
          },
        })
        .select("id")
        .single();

    expect(approvalBlockSnapshotError).toBeNull();

    const { data: approvalBlockManualBallot, error: approvalBlockManualError } =
      await supabase
        .from("manual_ballots")
        .insert({
          identity_status: "pending",
          imported_by: profile!.id,
          meeting_id: approvalBlockMeeting!.id,
          room_id: approvalBlockRoom!.id,
          source_label: "manual_pending_identity",
          status: "draft",
          voter_identity_text: approvalBlockIdentity,
        })
        .select("id")
        .single();

    expect(approvalBlockManualError).toBeNull();

    await page.goto(
      `${appUrl}/admin/results?meeting=${encodeURIComponent(
        approvalBlockTitle,
      )}&mode=edit&type=result_approval&id=${approvalBlockSnapshot!.id}`,
    );
    const approvalDrawer = page.getByLabel("Approve result");

    await expect(approvalDrawer.getByText(/pending manual vote identity/)).toBeVisible();
    await expect(
      approvalDrawer.getByRole("button", { name: "Approval blocked" }),
    ).toBeDisabled();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: approvalBlockTitle })
        .getByRole("link", { name: /Resolve 1 pending manual vote/ }),
    ).toBeVisible();

    const { data: approvalRows, error: approvalRowsError } = await supabase
      .from("committee_approvals")
      .select("id")
      .eq("meeting_id", approvalBlockMeeting!.id);

    expect(approvalRowsError).toBeNull();
    expect(approvalRows).toHaveLength(0);

    const { data: approvedEmailRows, error: approvedEmailRowsError } =
      await supabase
        .from("email_logs")
        .select("id")
        .eq("template_key", `result_approved:${approvalBlockMeeting!.id}`);

    expect(approvedEmailRowsError).toBeNull();
    expect(approvedEmailRows).toHaveLength(0);
    expect(approvalBlockManualBallot).toBeTruthy();
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
