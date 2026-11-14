import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Help guides are shown by role: everyone gets the owner guide; committee
// members, admins and auditors also get the committee guide.

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

type Supabase = ReturnType<typeof createClient<Database>>;

async function createUser(supabase: Supabase, label: string, roles: string[]) {
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
      preferred_language: "en",
    })
    .select("id")
    .single();

  expect(profileError).toBeNull();

  for (const role of roles) {
    const { error } = await supabase.from("app_roles").insert({ profile_id: profile!.id, role });
    expect(error).toBeNull();
  }

  return email;
}

async function signIn(page: Page, supabase: Supabase, email: string) {
  const { data: link, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  });

  expect(error).toBeNull();
  await page.goto(
    `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
      link.properties!.hashed_token,
    )}&type=${link.properties!.verification_type}`,
  );
  await expect(page).toHaveURL(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1):3000\/$/);
}

test.describe("@test:e2e @test:auth help by role", () => {
  test.skip(!supabaseUrl || !serviceKey, "Local Supabase service key is required.");

  const supabase = () =>
    createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  test("a committee member sees the committee guide", async ({ page }) => {
    test.setTimeout(120_000);
    const db = supabase();
    await signIn(page, db, await createUser(db, "help-committee", ["committee"]));

    await page.goto("/help");
    await expect(page.getByRole("link", { name: /How to vote online/ })).toBeVisible();
    await page.getByRole("link", { name: /Committee guide/ }).click();

    await expect(page).toHaveURL(/\/help\/committee$/);
    await expect(page.getByRole("heading", { name: "Committee guide" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Request a correction/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "For auditors" })).toBeVisible();
  });

  test("an auditor sees the committee guide", async ({ page }) => {
    test.setTimeout(120_000);
    const db = supabase();
    await signIn(page, db, await createUser(db, "help-auditor", ["auditor"]));

    await page.goto("/help/committee");
    await expect(page.getByRole("heading", { name: "Committee guide" })).toBeVisible();
  });

  test("a resident without a job role sees the owner guide only", async ({ page }) => {
    test.setTimeout(120_000);
    const db = supabase();
    await signIn(page, db, await createUser(db, "help-resident", []));

    await page.goto("/help");
    await expect(page.getByRole("link", { name: /How to vote online/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Committee guide/ })).toHaveCount(0);

    await page.goto("/help/committee");
    await expect(page).toHaveURL(/\/help$/);
  });
});
