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

test.describe("@test:e2e @test:admin @test:table-search table search", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for table search integration.",
  );

  test("audit table preserves filters while changing page and per page", async ({
    page,
  }) => {
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

    const auditPaginationAction = `e2e.audit.pagination.${Date.now()}`;
    const auditPaginationRows = Array.from({ length: 35 }, (_, index) => ({
      action: auditPaginationAction,
      actor_profile_id: profile!.id,
      created_at: new Date(Date.now() - index * 1000).toISOString(),
      details_json: { row: index + 1 },
      entity_type: "e2e_audit",
    }));
    const { error: auditPaginationError } = await supabase
      .from("audit_logs")
      .insert(auditPaginationRows);

    expect(auditPaginationError).toBeNull();

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

    await page.goto(
      `${appUrl}/admin/setup?tab=audit&actions=${encodeURIComponent(
        auditPaginationAction,
      )}&perPage=10`,
    );
    const auditSection = page
      .getByRole("heading", { name: "Business Audit Log" })
      .locator("xpath=ancestor::section[1]");
    const auditResults = auditSection
      .getByRole("heading", { name: "Results" })
      .locator("xpath=ancestor::section[1]");
    const auditPageSelect = auditResults.getByLabel("Page", { exact: true });
    const auditPerPageSelect = auditResults.getByLabel("Per page", {
      exact: true,
    });

    await expect(
      auditSection.getByRole("cell", { name: auditPaginationAction }).first(),
    ).toBeVisible();
    await expect(auditResults.getByText("Showing 1-10 of 35")).toBeVisible();
    await expect(auditPageSelect).toHaveValue("1");
    await expect(auditPerPageSelect).toHaveValue("10");

    await auditPageSelect.selectOption("2");
    await expect(page).toHaveURL(/page=2/);
    await expect(auditResults.getByText("Showing 11-20 of 35")).toBeVisible();

    await auditPerPageSelect.selectOption("25");
    await expect(page).toHaveURL(/perPage=25/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(auditPageSelect).toHaveValue("1");
    await expect(auditResults.getByText("Showing 1-25 of 35")).toBeVisible();

    await auditSection.getByRole("button", { name: "Search" }).click();
    await expect(auditPerPageSelect).toHaveValue("25");
    await expect(page).toHaveURL(/perPage=25/);

    await auditSection.getByRole("button", { name: "Clear" }).click();
    await expect(auditPerPageSelect).toHaveValue("25");
    await expect(auditPageSelect).toHaveValue("1");
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
