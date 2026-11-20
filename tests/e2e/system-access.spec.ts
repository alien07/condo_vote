import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appUrl, localEnv, serviceKey, supabaseUrl } from "./admin/admin-helpers";
import { confirmInApp } from "./confirm-dialog";

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The System Admin is apart from the building (req_0011 B, D027): no access
// by role; temporary read-only access with a reason, a banner and audit rows.
test.describe("@test:e2e @test:system system admin temporary access", () => {
  test.skip(!supabaseUrl || !serviceKey || !anonKey, "Local Supabase keys are required.");

  test("reads the building only while temporary access is open", async ({ page }) => {
    test.setTimeout(180_000);

    const admin = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const stamp = Date.now();
    const password = `pw-${stamp}-Aa1!`;
    const people: Record<string, { email: string; profileId: string; authId: string }> = {};

    for (const [key, role] of [["sys", "system_admin"], ["manager", "admin"]] as const) {
      const email = `access-${key}-${stamp}@example.test`;
      const { data: user, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });

      expect(error).toBeNull();
      const { data: profile } = await admin
        .from("profiles")
        .insert({
          approval_status: "approved",
          auth_user_id: user.user!.id,
          // A platform account: no member access of its own.
          default_status: key === "sys" ? "proxy" : "resident",
          email,
          full_name: `Access ${key} ${stamp}`,
          preferred_language: "en",
        })
        .select("id")
        .single();

      expect((await admin.from("app_roles").insert({ profile_id: profile!.id, role })).error).toBeNull();
      people[key] = { email, profileId: profile!.id, authId: user.user!.id };
    }

    async function signIn(target: Page, key: string) {
      const { data: link } = await admin.auth.admin.generateLink({
        email: people[key].email,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

      await target.context().clearCookies();
      await target.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(link.properties!.hashed_token)}&type=${
          link.properties!.verification_type
        }`,
      );
    }

    try {
      // Without access: the building's pages are closed.
      await signIn(page, "sys");
      await page.goto(`${appUrl}/admin/people`);
      await page.waitForURL(/denied=1/);

      // Open read-only access for one hour with a reason.
      await page.goto(`${appUrl}/system`);
      const form = page.locator("[data-access-form]");

      await form.locator("textarea[name='reason']").fill(`Support ticket ${stamp}`);
      await form.getByRole("button", { name: "Open read-only access" }).click();
      await confirmInApp(page, "Open read-only access");
      await page.waitForURL(/\/system\?[\s\S]*feedback=success/);
      await expect(page.locator("[data-access-active]")).toBeVisible();
      await expect(page.locator('[data-system-access-banner="mine"]')).toContainText("Changes are refused");

      // The building's pages open, read only.
      await page.goto(`${appUrl}/admin/people`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).not.toHaveURL(/denied=1/);
      await page.goto(`${appUrl}/audit`);
      await expect(page.getByRole("heading", { level: 1, name: "Audit" })).toBeVisible();

      // Writes are refused by the database, not only hidden.
      const sysClient = createClient<Database>(supabaseUrl!, anonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      expect((await sysClient.auth.signInWithPassword({ email: people.sys.email, password })).error).toBeNull();
      expect((await sysClient.from("rooms").select("id").limit(1)).error).toBeNull();
      expect(
        (await sysClient.from("rooms").insert({ room_number: `SA-${stamp}`, ownership_percent: 1 })).error?.message,
      ).toMatch(/row-level security/);
      expect(
        (await sysClient.from("app_roles").insert({ profile_id: people.sys.profileId, role: "admin" })).error?.message,
      ).toMatch(/row-level security/);

      // The Manager sees who has access on the overview.
      await signIn(page, "manager");
      await page.goto(`${appUrl}/admin`);
      await expect(page.locator('[data-system-access-banner="others"]')).toContainText(`Support ticket ${stamp}`);

      // End early: closed again, and the audit log has start and end.
      await signIn(page, "sys");
      await page.goto(`${appUrl}/system`);
      await page.getByRole("button", { name: "End access now" }).click();
      await confirmInApp(page);
      await page.waitForURL(/\/system\?[\s\S]*feedback=success/);
      await page.goto(`${appUrl}/admin/people`);
      await page.waitForURL(/denied=1/);

      const { data: rows } = await admin
        .from("audit_logs")
        .select("action")
        .eq("actor_profile_id", people.sys.profileId)
        .like("action", "system_access.%")
        .order("created_at");

      expect(rows?.map((row) => row.action)).toEqual(["system_access.started", "system_access.ended"]);
    } finally {
      await admin.from("system_read_access").delete().eq("profile_id", people.sys.profileId);
      await admin.from("app_roles").delete().in("profile_id", [people.sys.profileId, people.manager.profileId]);
    }
  });
});
