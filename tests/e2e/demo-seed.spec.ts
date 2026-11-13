// Checks the demo data from scripts/seed-demo.mjs (docs/demo-script.md).
// Runs only when DEMO_SEED=1, after `node scripts/seed-demo.mjs --reset --consent`:
// the seed resets the database, so it runs as its own CI step.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/personas";

test.skip(process.env.DEMO_SEED !== "1", "Set DEMO_SEED=1 after seeding demo data.");

function readLocalEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const localEnv = readLocalEnv();
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Returns the origin the sign-in landed on: the auth callback may redirect
// from 127.0.0.1 to localhost, and the session cookie belongs to that host.
async function signInAs(page: Page, key: DemoPersonaKey, next = "/") {
  await page.goto(`/auth/local-demo?as=${key}&next=${encodeURIComponent(next)}`);
  await expect(page).not.toHaveURL(/\/(login|auth)/);
  return new URL(page.url()).origin;
}

async function meetingId(prefix: string) {
  const { data, error } = await supabase
    .from("meetings")
    .select("id, status")
    .like("title", `${prefix} %`)
    .single();
  expect(error).toBeNull();
  return data!;
}

test.describe("demo seed", () => {
  test("data matches the demo script", async () => {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("ownership_percent")
      .eq("building", "DEMO-A");
    expect(rooms).toHaveLength(20);
    expect(rooms!.reduce((sum, room) => sum + Number(room.ownership_percent), 0)).toBeCloseTo(100);

    const m6 = await meetingId("DEMO M6");
    const m7 = await meetingId("DEMO M7");
    const m8 = await meetingId("DEMO M8");
    const m10 = await meetingId("DEMO M10");
    expect(m10.status).toBe("archived");

    const [{ count: m7Approvals }, { data: m8Publication }, { data: m6Manual }] =
      await Promise.all([
        supabase.from("committee_approvals").select("id", { count: "exact", head: true }).eq("meeting_id", m7.id),
        supabase.from("result_publications").select("approvals_count").eq("meeting_id", m8.id).single(),
        supabase.from("manual_ballots").select("identity_status").eq("meeting_id", m6.id),
      ]);
    expect(m7Approvals).toBe(1);
    expect(m8Publication?.approvals_count).toBe(2);
    expect(m6Manual!.map((row) => row.identity_status).sort()).toEqual(["linked", "pending"]);

    const { data: snapshot } = await supabase
      .from("result_snapshots")
      .select("payload_json")
      .eq("meeting_id", m8.id)
      .single();
    const payload = snapshot!.payload_json as {
      questions: Array<{ outcome: string }>;
      incidents: unknown[];
    };
    expect(payload.questions.map((question) => question.outcome)).toEqual(["decided", "not_decided"]);
    expect(payload.incidents).toHaveLength(1);

    const { data: emails } = await supabase
      .from("email_logs")
      .select("status, language")
      .like("template_key", "vote_invitation:%");
    expect(emails!.some((email) => email.status === "failed")).toBe(true);
    expect(new Set(emails!.map((email) => email.language))).toEqual(new Set(["th", "en"]));
  });

  test("login page lists the demo personas", async ({ page }) => {
    await page.goto("/login");

    for (const persona of DEMO_PERSONAS) {
      await expect(page.getByRole("link", { name: new RegExp(persona.caseLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
    }
  });

  test("owner A sees own rooms and the proxy room in M1", async ({ page }) => {
    await signInAs(page, "ownerA", "/vote");
    await expect(page.getByText("DEMO M1", { exact: false }).first()).toBeVisible();

    for (const room of ["A-101", "A-102", "A-103"]) {
      await expect(page.getByText(room).first()).toBeVisible();
    }
  });

  test("owner B sees the published M8 result", async ({ page }) => {
    const origin = await signInAs(page, "ownerB", "/summary");
    await expect(page.getByText("DEMO M8", { exact: false }).first()).toBeVisible();

    // Newest meeting first (M9 met after M8); the result on screen is marked.
    const current = page.locator('aside a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("DEMO M9");
    await expect(page.locator("aside a", { hasText: "DEMO" }).first()).toContainText("DEMO M9");
    await page.locator("aside a", { hasText: "DEMO M8" }).click();
    await expect(page.locator('aside a[aria-current="page"]')).toContainText("DEMO M8");

    // Every published result is reachable from the archive.
    await page.goto(`${origin}/summary/archive`);
    await expect(page.getByRole("heading", { name: "All results", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /DEMO M8/ })).toBeVisible();
  });

  test("result terms explain themselves", async ({ page }) => {
    const m8 = await meetingId("DEMO M8");
    await signInAs(page, "ownerB", `/summary/${m8.id}`);
    // M8 agenda 1 is decided on the ownership of rooms that voted.
    const firstTable = page.locator("table").first();
    await expect(firstTable.locator("th[data-deciding]")).toContainText("Decides this item");
    await expect(firstTable.locator("th[data-deciding]")).toContainText("Of votes cast");

    await firstTable.getByRole("button", { name: "What this means: Of votes cast" }).click();
    const tip = page.getByRole("tooltip");
    await expect(tip).toContainText("including rooms that abstained");
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  });

  test("committee sees M7 waiting for approval", async ({ page }) => {
    await signInAs(page, "committee", "/committee");
    await expect(page.getByText("DEMO M7", { exact: false }).first()).toBeVisible();
  });

  test("admin sees M6 blocked and M7 waiting", async ({ page }) => {
    const origin = await signInAs(page, "admin", "/admin/voting/conflicts");
    await expect(page.getByText("A-201").first()).toBeVisible();
    await page.goto(`${origin}/admin/results`);
    await expect(page.getByText("DEMO M7", { exact: false }).first()).toBeAttached();
  });

  test("resident cannot open admin pages", async ({ page }) => {
    const origin = await signInAs(page, "resident", "/summary");
    await page.goto(`${origin}/admin`);
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("new user must accept the PDPA notice", async ({ page }) => {
    await page.goto("/auth/local-demo?as=newUser&next=%2Fvote");
    await expect(page).toHaveURL(/\/consent/);
  });
});
