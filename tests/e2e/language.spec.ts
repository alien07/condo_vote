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

// D020: owner pages default to Thai; the switch is saved to the profile.
async function createOwner(supabase: ReturnType<typeof createClient<Database>>) {
  const stamp = Date.now();
  const email = `language-${stamp}@example.local`;
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `Language ${stamp}` },
  });

  expect(userError).toBeNull();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: userData.user!.id,
      email,
      full_name: `Language ${stamp}`,
      approval_status: "approved",
      default_status: "owner",
    })
    .select("id, preferred_language")
    .single();

  expect(profileError).toBeNull();
  expect(profile?.preferred_language).toBe("th");

  return { email, profileId: profile!.id };
}

async function signIn(
  page: Page,
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
) {
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
  await expect(page).toHaveURL(/:3000\/$/);
}

test.describe("@test:e2e @test:language owner language", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for language integration.",
  );

  test("login page is Thai by default and switches to English", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "th");

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "lang")?.value).toBe("en");
  });

  test("owner switch is saved to the profile and used on a new browser", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const owner = await createOwner(supabase);

    await page.context().clearCookies();
    await signIn(page, supabase, owner.email);
    await page.goto("/vote");
    await expect(page.getByRole("heading", { name: "ลงคะแนน", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vote", level: 1 })).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", owner.profileId)
          .single();

        return data?.preferred_language;
      })
      .toBe("en");

    // Without the browser cookie, the profile decides.
    await page.context().clearCookies({ name: "lang" });
    await page.goto("/summary");
    await expect(
      page.getByRole("heading", { name: "Result Summary", level: 1 }),
    ).toBeVisible();
  });
});
