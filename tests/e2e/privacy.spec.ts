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

type Supabase = ReturnType<typeof createClient<Database>>;

async function createUser(supabase: Supabase, label: string, roles: string[] = []) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${label}-${stamp}@example.local`;
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `${label} ${stamp}` },
  });

  expect(userError).toBeNull();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: userData.user!.id,
      email,
      full_name: `${label} ${stamp}`,
      approval_status: "approved",
      default_status: "resident",
    })
    .select("id")
    .single();

  expect(profileError).toBeNull();

  for (const role of roles) {
    const { error } = await supabase
      .from("app_roles")
      .insert({ profile_id: profile!.id, role });

    expect(error).toBeNull();
  }

  return { email, profileId: profile!.id };
}

async function setConsentRequired(supabase: Supabase, required: boolean) {
  const { error } = await supabase
    .from("privacy_settings")
    .update({ consent_required: required })
    .eq("id", true);

  expect(error).toBeNull();
}

test.describe("@test:e2e @test:auth @test:privacy privacy and system settings", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for privacy integration.",
  );

  test("new user accepts the privacy notice before using the app", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const user = await createUser(supabase, "consent");

    // Local and CI seed turn consent off; turn it on for this test only.
    await setConsentRequired(supabase, true);

    try {
      await signInByGeneratedLink(page, supabase, user.email);
      await page.goto("/vote");
      await expect(page).toHaveURL(/\/consent$/);
      await expect(
        page.getByRole("heading", { name: "Privacy Notice" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "I accept" }).click();
      await expect(page).toHaveURL(/:3000\/$/);

      await page.goto("/vote");
      await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();

      const { data: consents } = await supabase
        .from("profile_consents")
        .select("notice_version")
        .eq("profile_id", user.profileId);

      expect(consents).toHaveLength(1);
    } finally {
      await setConsentRequired(supabase, false);
    }
  });

  test("only system admins open the System page", async ({ page }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = await createUser(supabase, "meeting-admin", ["admin"]);
    const systemAdmin = await createUser(supabase, "system-admin", ["system_admin"]);
    const primaryNav = page.getByRole("navigation", {
      name: "Primary navigation",
    });

    await signInByGeneratedLink(page, supabase, admin.email);
    await page.goto("/system");
    await expect(page).toHaveURL(/\/\?denied=1$/);
    await expect(primaryNav.getByRole("link", { name: "System" })).toHaveCount(0);

    await page.goto("/admin/setup?tab=storage");
    await expect(
      page.getByText("Only a system admin can change technical settings."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save document storage config" }),
    ).toHaveCount(0);

    // Sign out by clearing the session; keep the English test language.
    await page.context().clearCookies({ name: /^(?!lang$)/ });
    await signInByGeneratedLink(page, supabase, systemAdmin.email);
    await page.goto("/system");
    await expect(
      page.getByRole("heading", { exact: true, name: "System" }),
    ).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "System" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Privacy and PDPA" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save privacy settings" }),
    ).toBeVisible();
  });
});
