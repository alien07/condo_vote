import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  toDateTimeLocal,
  gotoWithRetry,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: lifecycle (@full)", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  // End-to-end admin lifecycle. Tagged @full: it runs only in full-suite runs,
  // not in per-PR smoke tests. See docs/testing.md.
  test(
    "demo admin can sign in and manage master data",
    { tag: "@full" },
    async ({ page }) => {
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
    // Wait for the save to finish before navigating away.
    await page.waitForURL(/\/admin\/people\?[\s\S]*feedback=success/, {
      waitUntil: "domcontentloaded",
    });
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
      .getByRole("textbox", { exact: true, name: "Juristic person name" })
      .fill("Demo Juristic Person");
    await juristicSection
      .getByRole("textbox", { exact: true, name: "Project name" })
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
    await reviewProxyDrawer.getByRole("button", { name: "Save review" }).click();
    await confirmInApp(page);
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
    await resolveIdentityDrawer.getByRole("button", { name: "Link profile" }).click();
    await confirmInApp(page);
    await page.waitForURL(/\/admin\/voting\?[\s\S]*feedback=success/, {
      waitUntil: "domcontentloaded",
    });

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
    await expect(reviewConflictDialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText("Conflict resolved.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .filter({ hasText: roomNumber })
        .getByRole("cell", { name: "resolved", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Voting is still open, so close it on the committee page first (D014).
    await page.goto(
      `${activeAppOrigin}/admin/meetings?title=${encodeURIComponent(meetingTitle)}`,
    );
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: meetingTitle })
        .getByText("Voting open"),
    ).toBeVisible();
    // Closing early starts with a request (demo feedback item 10). The demo
    // admin joins the committee for this step, so the proposal counts as the
    // one approval this meeting needs.
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", demoAdminEmail)
      .single();
    await supabase
      .from("app_roles")
      .upsert({ profile_id: adminProfile!.id, role: "committee" }, { onConflict: "profile_id,role" });
    const { data: closeMember } = await supabase
      .from("committee_members")
      .insert({ profile_id: adminProfile!.id, full_name: "Demo close member", position_title: "Member" })
      .select("id")
      .single();

    try {
      await page.goto(`${activeAppOrigin}/committee`);
      const closeCard = page.locator("div[data-meeting-id]").filter({ hasText: meetingTitle });
      await closeCard.getByText("Propose closing early").first().click();
      await closeCard.locator('textarea[name="reason"]').fill("Every room has voted");
      await closeCard.getByRole("button", { name: "Send request" }).click();
      await confirmInApp(page);
      await page.waitForURL(/\/committee\?[\s\S]*feedback=success/);
      await expect(page.getByText("Approved: voting closes as requested")).toBeVisible();
    } finally {
      await supabase.from("committee_members").delete().eq("id", closeMember!.id);
      await supabase
        .from("app_roles")
        .delete()
        .eq("profile_id", adminProfile!.id)
        .eq("role", "committee");
    }

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
    // The status badge; "Voting closed <time>" also contains the word.
    await expect(closedVoteCard.getByText("Closed", { exact: true })).toBeVisible();
    await expect(closedVoteCard.getByText(/^Voting closed /)).toBeVisible();
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
      resultRow.getByRole("cell", {
        name: "pending (0/1 approvals)",
        exact: true,
      }),
    ).toBeVisible();
    // Separation of duties (item 14a): whoever generated a result cannot
    // approve it. Here the result counts as generated by another admin.
    const { data: generatedMeeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("title", meetingTitle)
      .single();
    const { error: generatorError } = await supabase
      .from("result_snapshots")
      .update({ generated_by: null })
      .eq("meeting_id", generatedMeeting!.id);
    expect(generatorError).toBeNull();
    await resultRow.getByRole("link", { name: "Approve result" }).click();
    const approveResultDrawer = page.getByLabel("Approve result");
    await approveResultDrawer.getByRole("button", { name: "Approve result" }).click();
    await confirmInApp(page);
    await page.waitForURL(/\/admin\/results\?[\s\S]*feedback=success/, {
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
    // D019: both result documents show the numbers of the published snapshot.
    const persistedMeetingId = persistedMeetingResult.data!.id;
    const [publicationResult, eligibleResult] = await Promise.all([
      supabase
        .from("result_publications")
        .select("result_snapshot_id, result_snapshots(payload_sha256)")
        .eq("meeting_id", persistedMeetingId)
        .single(),
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", persistedMeetingId),
    ]);

    expect(publicationResult.error).toBeNull();
    expect(eligibleResult.error).toBeNull();
    const publishedSnapshotId = publicationResult.data!.result_snapshot_id;
    const publishedHash = publicationResult.data!.result_snapshots!.payload_sha256!;
    const totalOwnership = eligibleResult.data!.reduce(
      (sum, row) => sum + Number(row.ownership_percent),
      0,
    );
    const votedOwnership = Number(
      eligibleResult.data!.find(
        (row) => row.room_id === persistedRoomResult.data!.id,
      )!.ownership_percent,
    );
    const shareOfAll = `${((votedOwnership / totalOwnership) * 100).toFixed(2)}%`;

    expect(publishedHash).toMatch(/^[0-9a-f]{64}$/);
    await gotoWithRetry(page, `${activeAppOrigin}/record/${publishedSnapshotId}`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("heading", { name: "บันทึกผลการลงมติ", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(meetingTitle).first()).toBeVisible();
    await expect(page.getByText("เผยแพร่ผลเมื่อ", { exact: false })).toBeVisible();
    await expect(page.getByText("1 ห้อง (เลือกแหล่งแล้ว 1)")).toBeVisible();
    // The only voting room chose this option, so it decides the question (D013).
    const recordChoiceRow = page
      .getByRole("row")
      .filter({ hasText: updatedChoiceText });
    await expect(recordChoiceRow.getByRole("cell").nth(1)).toHaveText("1");
    await expect(recordChoiceRow.getByRole("cell").nth(2)).toHaveText(shareOfAll);
    await expect(recordChoiceRow.getByRole("cell").nth(3)).toHaveText("100.00%");
    await expect(page.getByText(`ผล: มีมติ: ${updatedChoiceText}`)).toBeVisible();
    await expect(page.getByText(publishedHash).first()).toBeVisible();

    // The owner summary in Thai (D020); other specs browse in English. The
    // signed-in profile's language comes first, so switch the profile.
    const setLanguageCookie = async (value: "th" | "en") => {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_language: value })
        .eq("email", demoAdminEmail);

      expect(error).toBeNull();
      await page.context().addCookies([
        { name: "lang", value, url: activeAppOrigin },
      ]);
    };

    await setLanguageCookie("th");
    await gotoWithRetry(page, `${activeAppOrigin}/summary/${persistedMeetingId}`, {
      waitUntil: "commit",
    });
    await expect(page.getByText("ประกาศผลการลงมติ (ฉบับสรุป)")).toBeVisible();
    const summaryChoiceRow = page
      .getByRole("row")
      .filter({ hasText: updatedChoiceText });
    await expect(summaryChoiceRow.getByRole("cell").nth(2)).toHaveText(shareOfAll);
    await expect(summaryChoiceRow.getByRole("cell").nth(3)).toHaveText("100.00%");
    await expect(page.getByText(publishedHash)).toBeVisible();
    await page.getByRole("link", { name: "ตรวจสอบเลขอ้างอิงนี้" }).click();
    await expect(page).toHaveURL(new RegExp(`/verify/${publishedSnapshotId}$`));
    await expect(page.getByText(publishedHash)).toBeVisible();
    await setLanguageCookie("en");

    // D021: publishing makes three master PDF files in the background.
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("result_documents")
            .select("kind, language")
            .eq("result_snapshot_id", publishedSnapshotId);

          return (data ?? []).map((file) => `${file.kind}-${file.language}`).sort();
        },
        { timeout: 90_000 },
      )
      .toEqual(["official-th", "summary-en", "summary-th"]);
    const { data: officialFile } = await supabase
      .from("result_documents")
      .select("sha256")
      .eq("result_snapshot_id", publishedSnapshotId)
      .eq("kind", "official")
      .single();
    const officialPdf = await page.request.get(
      `${activeAppOrigin}/result-files/${publishedSnapshotId}/official-th.pdf`,
    );

    expect(officialPdf.ok()).toBe(true);
    const officialBytes = await officialPdf.body();

    expect(officialBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(createHash("sha256").update(officialBytes).digest("hex")).toBe(
      officialFile!.sha256,
    );

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
});
