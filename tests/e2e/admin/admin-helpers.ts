import { isoToBangkokLocalInput } from "@/lib/datetime";
import fs from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const demoAdminEmail = "demo.admin@example.test";
export const demoAdminName = "Demo Admin";
export const appUrl = "http://localhost:3000";

export function readLocalEnv() {
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

export const localEnv = readLocalEnv();
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
export const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  localEnv.SUPABASE_SECRET_KEY ||
  localEnv.SUPABASE_SERVICE_ROLE_KEY;

// The form takes Bangkok time, whatever time zone the test machine uses.
export function toDateTimeLocal(date: Date) {
  date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 10) * 10, 0, 0);

  return isoToBangkokLocalInput(date.toISOString());
}

export async function gotoWithRetry(
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

export async function findUserByEmail(
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

/**
 * Picks a row in a SearchSelect (type-to-search box): types `text`, then
 * clicks the row whose label is exactly `text`, or the first row (use an
 * email, which is unique, to pick a person).
 */
export async function chooseSearchOption(scope: Locator, name: string, text: string) {
  const box = scope.locator(`[data-focus-for="${name}"]`);
  await box.click();
  await box.fill(text);
  await expect(scope.locator('[role="option"]').first()).toBeVisible();
  const exact = scope.locator(`[role="option"][data-label=${JSON.stringify(text)}]`);
  await ((await exact.count()) > 0 ? exact.first() : scope.locator('[role="option"]').first()).click();
  await expect(scope.locator(`input[type="hidden"][name="${name}"]`)).not.toHaveValue("");
}
