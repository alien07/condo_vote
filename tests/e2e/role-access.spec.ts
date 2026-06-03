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

type TestRole = "admin" | "resident";

async function ensureTestProfile(
  supabase: ReturnType<typeof createClient<Database>>,
  role: TestRole,
) {
  const timestamp = Date.now();
  const email = `${role}-access-${timestamp}@example.local`;
  const fullName = `${role} access ${timestamp}`;
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
      default_status: role === "admin" ? "owner" : "resident",
    })
    .select("id")
    .single();

  expect(profileError).toBeNull();

  if (role === "admin") {
    const { error: roleError } = await supabase.from("app_roles").insert({
      profile_id: profile!.id,
      role: "admin",
    });

    expect(roleError).toBeNull();
  }

  return {
    email,
    profileId: profile!.id,
  };
}

async function signInByGeneratedLink(
  page: Page,
  supabase: ReturnType<typeof createClient<Database>>,
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

test.describe("@test:e2e @test:auth @test:role role access", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for role access integration.",
  );

  test("admin can access admin, vote, and summary pages", async ({ page }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const admin = await ensureTestProfile(supabase, "admin");

    await signInByGeneratedLink(page, supabase, admin.email);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByText(admin.email)).toBeVisible();
    await expect(page.getByText(/owner \/ admin/)).toBeVisible();
    const primaryNav = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    await expect(primaryNav.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Vote" })).toBeVisible();
    await expect(
      primaryNav.getByRole("link", { name: "Summary" }),
    ).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(admin.email)).toBeVisible();
    await expect(page.getByText(/owner \/ admin/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);

    await page.goto("/admin/communications");
    await expect(
      page.getByRole("heading", { name: "Communications" }),
    ).toBeVisible();

    await page.goto("/vote");
    await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();

    await page.goto("/summary");
    await expect(
      page.getByRole("heading", { exact: true, name: "Result Summary" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("resident cannot access admin pages but can access summary", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const resident = await ensureTestProfile(supabase, "resident");

    await signInByGeneratedLink(page, supabase, resident.email);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/admin/communications");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/summary");
    await expect(
      page.getByRole("heading", { exact: true, name: "Result Summary" }),
    ).toBeVisible();
    await expect(page.getByText(resident.email)).toBeVisible();
    await expect(page.getByText(/resident \/ user/)).toBeVisible();
    const primaryNav = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    await expect(primaryNav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(primaryNav.getByRole("link", { name: "Vote" })).toBeVisible();
    await expect(
      primaryNav.getByRole("link", { name: "Summary" }),
    ).toBeVisible();

    await page.goto("/vote");
    await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No eligible voting assignments" }),
    ).toBeVisible();
  });
});
