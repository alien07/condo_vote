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
    const questionText = `Approve item ${Date.now()}?`;
    const choiceText = `Yes ${Date.now()}`;

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

    await page.goto(`${activeAppOrigin}/admin`);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
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

    await page.getByPlaceholder("Meeting title").fill(meetingTitle);
    await page.locator('input[name="starts_at"]').first().fill("2026-06-01T09:00");
    await page.locator('input[name="ends_at"]').first().fill("2026-06-01T10:00");
    await page.getByRole("button", { name: "Add meeting" }).click();
    await expect(page.getByRole("cell", { name: meetingTitle })).toBeVisible();

    await page
      .locator('select[name="meeting_id"]')
      .first()
      .selectOption({ label: meetingTitle });
    await page.getByPlaceholder("Question").fill(questionText);
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByText(questionText)).toBeVisible();
    await page.getByPlaceholder("Choice").fill(choiceText);
    await page.getByRole("button", { name: "Add choice" }).click();
    await expect(page.getByText(choiceText)).toBeVisible();

    await page.getByPlaceholder("Room number").fill(roomNumber);
    await page.getByPlaceholder("Ownership %").fill("1.25");
    await page.getByRole("button", { name: "Add room" }).click();
    await expect(page.getByRole("cell", { name: roomNumber })).toBeVisible();

    await page.getByPlaceholder("Full name").fill(ownerName);
    await page.getByPlaceholder("Email").fill("owner.demo@example.com");
    await page.getByRole("button", { name: "Add owner" }).click();
    await expect(page.getByRole("cell", { name: ownerName })).toBeVisible();

    await page
      .locator('select[name="room_id"]')
      .first()
      .selectOption({ label: roomNumber });
    await page
      .locator('select[name="owner_id"]')
      .first()
      .selectOption({ label: ownerName });
    await page.locator('input[name="starts_at"]').last().fill("2026-06-01");
    await page.getByRole("button", { name: "Link owner to room" }).click();
    await expect(page.getByRole("cell", { name: roomNumber })).toBeVisible();
    await expect(page.getByRole("cell", { name: ownerName })).toBeVisible();

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
