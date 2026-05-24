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
    const manualAuditNote = `Batch A row ${Date.now()}`;
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
          default_status: "resident",
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
    expect(link.properties?.hashed_token).toBeTruthy();
    expect(link.properties?.verification_type).toBeTruthy();

    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );
    await expect(page).toHaveURL(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1):3000\/$/);
    const activeAppOrigin = new URL(page.url()).origin;
    await page.goto(
      `${activeAppOrigin}/vote/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000`,
    );
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin`);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await page.goto(`${activeAppOrigin}/admin/people`);
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    const demoAdminRow = page
      .getByRole("row")
      .filter({ hasText: demoAdminEmail });
    await demoAdminRow.locator('select[name="default_status"]').selectOption("owner");
    await demoAdminRow
      .locator('select[name="approval_status"]')
      .selectOption("approved");
    await demoAdminRow.getByRole("button", { name: "Save" }).click();
    await expect(
      demoAdminRow.getByRole("cell", { name: "owner", exact: true }),
    ).toBeVisible();
    await expect(
      demoAdminRow.getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible();
    await demoAdminRow.locator('select[name="role"]').selectOption("committee");
    await demoAdminRow.getByRole("button", { name: "Grant role" }).click();
    await expect(
      demoAdminRow.locator("td").nth(4).getByText("committee", { exact: true }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/setup`);
    const juristicSection = page
      .getByRole("heading", { name: "Juristic Person" })
      .locator("xpath=ancestor::section[1]");
    await juristicSection
      .getByPlaceholder("Juristic person name")
      .fill("Demo Juristic Person");
    await juristicSection.getByPlaceholder("Project name").fill("Demo Condo");
    await juristicSection.getByPlaceholder("Registration no.").fill("REG-001");
    await juristicSection.getByPlaceholder("Juristic manager").fill("Demo Manager");
    await juristicSection
      .getByRole("button", { name: "Save juristic profile" })
      .click();
    await expect(juristicSection.locator('input[name="juristic_name"]')).toHaveValue(
      "Demo Juristic Person",
    );

    const committeeSection = page
      .getByRole("heading", { name: "Committee Members" })
      .locator("xpath=ancestor::section[1]");
    await committeeSection.getByPlaceholder("Committee name").fill(committeeName);
    await committeeSection.getByPlaceholder("Position").fill("Chairperson");
    await committeeSection
      .getByRole("button", { name: "Add committee member" })
      .click();
    await expect(
      committeeSection.getByRole("cell", { name: committeeName }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/meetings`);
    await page.getByPlaceholder("Meeting title").fill(meetingTitle);
    await page.getByPlaceholder("Meeting no.").fill("AGM-2026-001");
    await page.getByPlaceholder("Fiscal year").fill("2026");
    await page.getByPlaceholder("Location / platform").fill("Online");
    await page.getByPlaceholder("Chairperson").fill(committeeName);
    await page.locator('input[name="starts_at"]').first().fill(startsAt);
    await page.locator('input[name="ends_at"]').first().fill(endsAt);
    await page.getByRole("button", { name: "Add meeting" }).click();
    await expect(page.getByRole("cell", { name: meetingTitle })).toBeVisible();

    const questionsSection = page
      .getByRole("heading", { name: "Questions And Choices" })
      .locator("xpath=ancestor::section[1]");
    await questionsSection
      .locator('select[name="meeting_id"]')
      .selectOption({ label: meetingTitle });
    await questionsSection.getByPlaceholder("Agenda no.").fill("1");
    await questionsSection.getByPlaceholder("Agenda title").fill("Approve demo agenda");
    await questionsSection.getByPlaceholder("Question").fill(questionText);
    await questionsSection
      .locator('select[name="required_threshold"]')
      .selectOption("majority_submitted");
    await questionsSection.getByRole("button", { name: "Add question" }).click();
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

    await page.goto(`${activeAppOrigin}/admin/people`);
    await page.getByPlaceholder("Room number").fill(roomNumber);
    await page.getByPlaceholder("Ownership %").fill("1.25");
    await page.getByRole("button", { name: "Add room" }).click();
    await expect(page.getByRole("cell", { name: roomNumber })).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/voting`);
    const manualVotesSection = page
      .getByRole("heading", { name: "Manual Votes" })
      .locator("xpath=ancestor::section[1]");
    await manualVotesSection
      .locator('select[name="meeting_id"]')
      .selectOption({ label: meetingTitle });
    await manualVotesSection
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
    await manualVotesSection
      .locator('select[name="question_id"]')
      .selectOption({ label: `${meetingTitle} / 1 ${questionText}` });
    await manualVotesSection
      .locator('select[name="choice_id"]')
      .selectOption({ label: `${questionText} / ${choiceText}` });
    await manualVotesSection.getByPlaceholder("Source label").fill("Paper ballot");
    await manualVotesSection.getByPlaceholder("Audit note").fill(manualAuditNote);
    await manualVotesSection
      .getByRole("button", { name: "Import manual vote" })
      .click();
    await expect(
      manualVotesSection
        .getByRole("row")
        .filter({ hasText: roomNumber })
        .filter({ hasText: manualAuditNote }),
    ).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/people`);
    const ownerSection = page
      .getByRole("heading", { name: "Owners" })
      .locator("xpath=ancestor::section[1]");
    await page.getByPlaceholder("Full name").fill(ownerName);
    await ownerSection.getByPlaceholder("Email").fill("owner.demo@example.com");
    await ownerSection.getByRole("button", { name: "Add owner" }).click();
    await expect(page.getByRole("cell", { name: ownerName })).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/ownership`);
    const roomOwnershipSection = page
      .getByRole("heading", { name: "Room Ownership" })
      .locator("xpath=ancestor::section[1]");
    await roomOwnershipSection
      .locator('select[name="room_id"]')
      .selectOption({ label: roomNumber });
    await roomOwnershipSection
      .locator('select[name="owner_id"]')
      .selectOption({ label: ownerName });
    await roomOwnershipSection.locator('input[name="starts_at"]').fill("2026-06-01");
    await roomOwnershipSection
      .getByRole("button", { name: "Link owner to room" })
      .click();
    const roomOwnerRow = roomOwnershipSection
      .getByRole("row")
      .filter({ hasText: roomNumber })
      .filter({ hasText: ownerName });
    await expect(roomOwnerRow).toBeVisible();

    await page.goto(`${activeAppOrigin}/admin/proxies`);
    await page
      .locator('select[name="meeting_id"]')
      .last()
      .selectOption({ label: meetingTitle });
    await page.locator('select[name="room_id"]').last().selectOption({
      label: roomNumber,
    });
    await page
      .locator('select[name="owner_id"]')
      .last()
      .selectOption({ label: ownerName });
    await page
      .locator('select[name="proxy_profile_id"]')
      .selectOption({ label: `${demoAdminName} (${demoAdminEmail})` });
    await page.getByRole("button", { name: "Add proxy authorization" }).click();
    const proxyRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      proxyRow.getByRole("cell", { name: "pending", exact: true }),
    ).toBeVisible();
    await proxyRow.locator('select[name="status"]').selectOption("approved");
    await proxyRow.getByRole("button", { name: "Review" }).click();
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
    await resultRow.getByRole("button", { name: "Approve result" }).click();
    await expect(
      resultRow.getByRole("cell", { name: "approved", exact: true }),
    ).toBeVisible();
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
      lockedResultRow.getByRole("button", { name: "Approve result" }),
    ).toHaveCount(0);
    await page.goto(`${activeAppOrigin}/admin/communications`);
    await expect(page.getByText(/result_approved:/).first()).toBeVisible();
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
