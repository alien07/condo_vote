// Checks the demo data from scripts/seed-demo.mjs (req_0010,
// docs/demo-script.md). Runs only when DEMO_SEED=1, after
// `node scripts/seed-demo.mjs --reset --consent`: the seed resets the
// database, so it runs as its own CI step.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO_GROUPS, DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/personas";

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
  await page.context().clearCookies();
  await page.goto(`/auth/local-demo?as=${key}&next=${encodeURIComponent(next)}`);
  await expect(page).not.toHaveURL(/\/(login|auth)/);
  return new URL(page.url()).origin;
}

async function meeting(prefix: string) {
  const { data, error } = await supabase
    .from("meetings")
    .select("id, status, title, title_en")
    .like("title", `${prefix} %`)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function latestSnapshot(meetingId: string) {
  const { data } = await supabase
    .from("result_snapshots")
    .select("id, payload_json")
    .eq("meeting_id", meetingId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  return data!;
}

test.describe("demo seed", () => {
  test("data matches the demo script", async () => {
    const { data: rooms } = await supabase.from("rooms").select("ownership_percent").eq("building", "DEMO-A");
    expect(rooms).toHaveLength(20);
    expect(rooms!.reduce((sum, room) => sum + Number(room.ownership_percent), 0)).toBeCloseTo(100);

    const { count: members } = await supabase
      .from("committee_members")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    expect(members).toBe(5);

    // Every demo text has English (D020).
    const { data: meetings } = await supabase.from("meetings").select("title, title_en").like("title", "DEMO %");
    expect(meetings!.length).toBe(15);
    expect(meetings!.filter((row) => !row.title_en)).toEqual([]);

    expect((await meeting("DEMO M15")).status).toBe("archived");
    expect((await meeting("DEMO M6")).status).toBe("draft");

    // Published: 3 of 5 (D027), kept on the publication.
    const m13 = await meeting("DEMO M13");
    const { data: publication } = await supabase
      .from("result_publications")
      .select("approvals_count, committee_members, required_approvals")
      .eq("meeting_id", m13.id)
      .single();
    expect(publication).toEqual({ approvals_count: 3, committee_members: 5, required_approvals: 3 });
    const m13Payload = (await latestSnapshot(m13.id)).payload_json as {
      questions: Array<{ outcome: string }>;
      incidents: unknown[];
    };
    expect(m13Payload.questions.map((question) => question.outcome)).toEqual(["decided", "not_decided"]);
    expect(m13Payload.incidents).toHaveLength(1);

    // Waiting, not passed, tie, correction.
    const [m9, m10, m11, m12] = await Promise.all(["DEMO M9", "DEMO M10", "DEMO M11", "DEMO M12"].map(meeting));
    const counts = async (meetingId: string) => {
      const snapshot = await latestSnapshot(meetingId);
      const [{ count: approvals }, { count: objections }] = await Promise.all([
        supabase.from("committee_approvals").select("id", { count: "exact", head: true }).eq("result_snapshot_id", snapshot.id),
        supabase.from("result_objections").select("id", { count: "exact", head: true }).eq("result_snapshot_id", snapshot.id),
      ]);
      return [approvals, objections];
    };
    expect(await counts(m9.id)).toEqual([2, 0]);
    expect(await counts(m10.id)).toEqual([1, 3]);
    expect(await counts(m11.id)).toEqual([2, 2]);
    const { data: correction } = await supabase
      .from("result_correction_requests")
      .select("status, level")
      .eq("meeting_id", m12.id)
      .single();
    expect(correction).toEqual({ status: "open", level: "medium" });
    const { count: notPassedMail } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("template_key", `result_not_passed:${m10.id}`);
    expect(notPassedMail).toBeGreaterThan(0);

    // Paper ballots: a conflict and an identity to confirm.
    const m8 = await meeting("DEMO M8");
    const { data: m8Manual } = await supabase.from("manual_ballots").select("identity_status").eq("meeting_id", m8.id);
    expect(m8Manual!.map((row) => row.identity_status).sort()).toEqual(["linked", "pending"]);

    // Proxies and the co-owner in M1.
    const m1 = await meeting("DEMO M1");
    const { data: proxies } = await supabase.from("proxy_authorizations").select("kind, status").eq("meeting_id", m1.id);
    expect(proxies!.map((row) => `${row.kind}:${row.status}`).sort()).toEqual([
      "co_owner:approved",
      "proxy:approved",
      "proxy:approved",
      "proxy:pending",
      "proxy:pending",
    ]);

    const { data: emails } = await supabase.from("email_logs").select("status, language").like("template_key", "vote_invitation:%");
    expect(emails!.some((email) => email.status === "failed")).toBe(true);
    expect(new Set(emails!.map((email) => email.language))).toEqual(new Set(["th", "en"]));
  });

  test("login page lists the personas by role", async ({ page }) => {
    await page.goto("/login");

    for (const group of Object.keys(DEMO_GROUPS)) {
      const box = page.locator(`[data-demo-group="${group}"]`);
      await expect(box).toBeVisible();

      for (const persona of DEMO_PERSONAS.filter((entry) => entry.group === group)) {
        await expect(box.locator(`[data-demo-persona="${persona.key}"]`)).toBeVisible();
      }
    }
  });

  // Role matrix (req_0010): every link in the main menu opens, and the pages
  // a role must not open are denied.
  const OFFICE = ["/admin", "/admin/people"];
  const MANAGER_ONLY = ["/admin/meetings", "/admin/results"];
  const matrix: Record<Exclude<DemoPersonaKey, "newUser">, { open: string[]; denied: string[] }> = {
    manager: { open: [...OFFICE, ...MANAGER_ONLY, "/committee", "/audit"], denied: ["/system"] },
    staff: { open: OFFICE, denied: [...MANAGER_ONLY, "/committee", "/audit", "/system"] },
    auditor: { open: ["/audit"], denied: ["/admin", "/committee", "/system"] },
    chair: { open: ["/committee"], denied: ["/admin", "/audit", "/system"] },
    viceChair: { open: ["/committee"], denied: ["/admin", "/audit", "/system"] },
    member: { open: ["/committee"], denied: ["/admin", "/audit", "/system"] },
    ownerTh: { open: ["/vote"], denied: ["/admin", "/committee", "/audit", "/system"] },
    ownerEn: { open: ["/vote", "/summary"], denied: ["/admin", "/committee", "/audit", "/system"] },
    ownerCo: { open: ["/vote"], denied: ["/admin", "/committee", "/audit", "/system"] },
    coOwner: { open: ["/vote"], denied: ["/admin", "/committee", "/audit", "/system"] },
    resident: { open: ["/summary"], denied: ["/admin", "/committee", "/audit", "/system"] },
    proxyHolder: { open: ["/vote"], denied: ["/admin", "/committee", "/audit", "/system"] },
    systemAdmin: { open: ["/system"], denied: ["/admin", "/committee", "/audit"] },
  };

  for (const [key, access] of Object.entries(matrix) as Array<[DemoPersonaKey, { open: string[]; denied: string[] }]>) {
    test(`role matrix: ${key}`, async ({ page }) => {
      const origin = await signInAs(page, key, access.open[0]);
      const nav = page.getByRole("navigation", { name: /Primary navigation|เมนูหลัก/ });
      const links = await nav.locator("a[href^='/']").evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute("href")!),
      );

      for (const href of [...new Set([...links, ...access.open])]) {
        await page.goto(`${origin}${href}`);
        await expect(page, `${key} opens ${href}`).not.toHaveURL(/denied=1/);
      }

      for (const href of access.denied) {
        await page.goto(`${origin}${href}`);
        await expect(page, `${key} is denied ${href}`).toHaveURL(/denied=1/);
      }
    });
  }

  test("คุณอนันต์ votes 2 own rooms and the proxy room in M1", async ({ page }) => {
    await signInAs(page, "ownerTh", "/vote");
    await expect(page.getByText("DEMO M1", { exact: false }).first()).toBeVisible();

    for (const room of ["A-101", "A-102", "A-103"]) {
      await expect(page.getByText(room).first()).toBeVisible();
    }
  });

  test("the co-owner and the external proxy holder each see their room", async ({ page }) => {
    await signInAs(page, "coOwner", "/vote");
    await expect(page.getByText("A-110").first()).toBeVisible();
    await signInAs(page, "proxyHolder", "/vote");
    await expect(page.getByText("A-107").first()).toBeVisible();
    // English: the meeting title in English (D020).
    await expect(page.getByText("DEMO M1 · Annual general meeting 2026", { exact: false }).first()).toBeVisible();
  });

  test("Emma reads the published results in English", async ({ page }) => {
    const origin = await signInAs(page, "ownerEn", "/summary");
    // Newest meeting first (M14 met after M13); the result on screen is marked.
    const current = page.locator('aside a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("DEMO M14 · Second call");
    await page.locator("aside a", { hasText: "DEMO M13" }).click();
    await expect(page.locator('aside a[aria-current="page"]')).toContainText("DEMO M13");

    // Result terms explain themselves: M13 agenda 1 is decided on the
    // ownership of rooms that voted.
    const firstTable = page.locator("table").first();
    await expect(firstTable.locator("th[data-deciding]")).toContainText("Decides this item");
    await firstTable.getByRole("button", { name: "What this means: Of votes cast" }).click();
    await expect(page.getByRole("tooltip")).toContainText("including rooms that abstained");
    await page.keyboard.press("Escape");

    await page.goto(`${origin}/summary/archive`);
    await expect(page.getByRole("heading", { name: "All results", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /DEMO M15/ })).toBeVisible();
  });

  test("the committee: Mark can still answer M9, the chair breaks the M11 tie", async ({ page }) => {
    const [m9, m11] = await Promise.all([meeting("DEMO M9"), meeting("DEMO M11")]);
    const m9Snapshot = await latestSnapshot(m9.id);
    const m11Snapshot = await latestSnapshot(m11.id);

    await signInAs(page, "member", "/committee");
    await expect(page.locator("[data-committee-members]")).toContainText("5 active committee members");
    const m9Card = page.locator(`[data-result-snapshot-id="${m9Snapshot.id}"]`);
    await expect(m9Card.locator("[data-tally-line]")).toHaveText("Approved 2 · Not approved 0 · Needs 3 of 5");
    await expect(m9Card.getByRole("button", { name: "Approve result" })).toBeVisible();
    await expect(page.locator(`[data-result-snapshot-id="${m11Snapshot.id}"] [data-tie-waiting]`)).toBeVisible();

    await signInAs(page, "chair", "/committee");
    await expect(page.locator(`[data-result-snapshot-id="${m11Snapshot.id}"] [data-casting-form]`)).toBeVisible();
  });

  test("the Manager sees the paper-ballot conflict and the result that did not pass", async ({ page }) => {
    const origin = await signInAs(page, "manager", "/admin");
    await expect(page.locator('[data-overview-group="attention"]')).toContainText("ผลที่ไม่ผ่านการอนุมัติ");
    await page.goto(`${origin}/admin/voting/conflicts`);
    await expect(page.getByText("A-201").first()).toBeVisible();
    await page.goto(`${origin}/admin/results?approval=not_passed`);
    await expect(page.locator("[data-result-not-passed]").first()).toContainText("ไม่ผ่านการอนุมัติ");
  });

  test("the System Admin has no building rights until temporary access", async ({ page }) => {
    const origin = await signInAs(page, "systemAdmin", "/system");
    await expect(page.locator("[data-access-form]")).toBeVisible();
    await page.goto(`${origin}/admin`);
    await expect(page).toHaveURL(/denied=1/);
  });

  test("new user must accept the PDPA notice", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/local-demo?as=newUser&next=%2Fvote");
    await expect(page).toHaveURL(/\/consent/);
  });
});
