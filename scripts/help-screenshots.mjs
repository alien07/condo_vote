// Screenshots and quick-guide PDFs for the in-app help (/help).
//
//   npm run demo:seed -- --reset --consent   demo data the shots are taken from
//   npm run dev                              (next dev serves new public/ files)
//   npm run help:screenshots                 public/help/<lang>/*.png
//   npm run help:pdf                         public/help/<guide>-quick-guide-<lang>.pdf
//
// Re-run after UI changes, so the guide always shows the current screens.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = process.env.HELP_APP_URL ?? "http://localhost:3000";
const host = new URL(appUrl).hostname;
const LOCALES = ["th", "en"];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

function readEnv() {
  const file = path.join(root, ".env.local");
  const fileEnv = fs.existsSync(file)
    ? Object.fromEntries(
        fs
          .readFileSync(file, "utf8")
          .split(/\r?\n/)
          .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
          .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")]),
      )
    : {};
  return (key) => process.env[key] || fileEnv[key];
}

const browser = await chromium.launch();

async function newContext(locale, options = PHONE) {
  const context = await browser.newContext({ ...options, locale: locale === "th" ? "th-TH" : "en-US" });
  await context.addCookies([{ name: "lang", value: locale, domain: host, path: "/" }]);
  // `next dev` compiles each page on first visit.
  context.setDefaultNavigationTimeout(120_000);
  return context;
}

async function signIn(context, persona, next) {
  const page = await context.newPage();
  await page.goto(`${appUrl}/auth/local-demo?as=${persona}&next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  return page;
}

async function save(page, locale, name) {
  const dir = path.join(root, "public", "help", locale);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log(`[help] ${locale}/${name}.png`);
}

async function screenshots() {
  const env = readEnv();
  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const one = async (query, label) => {
    const { data, error } = await query;

    if (error || !data) {
      throw new Error(`${label}: ${error?.message ?? "not found"}. Run npm run demo:seed -- --reset --consent first.`);
    }

    return data;
  };
  const room = await one(db.from("rooms").select("id").eq("room_number", "A-101").single(), "room A-101");
  const m1 = await one(db.from("meetings").select("id").like("title", "DEMO M1 %").single(), "meeting M1");
  const m8 = await one(db.from("meetings").select("id").like("title", "DEMO M8 %").single(), "meeting M8");
  const privacy = await one(db.from("privacy_settings").select("consent_required").single(), "privacy");

  if (!privacy.consent_required) {
    throw new Error("The PDPA screen is off. Run npm run demo:seed -- --reset --consent first.");
  }

  for (const locale of LOCALES) {
    // Signed out: the sign-in page.
    const guest = await newContext(locale);
    const login = await guest.newPage();
    await login.goto(`${appUrl}/login`);
    await login.waitForLoadState("networkidle");
    // Owners never see the local demo buttons.
    await login.evaluate(() => document.querySelector("[data-demo-signin]")?.remove());
    await save(login, locale, "owner-login");
    await guest.close();

    // A new user meets the PDPA notice. Not accepted, so it works for both languages.
    const fresh = await newContext(locale);
    await save(await signIn(fresh, "newUser", "/vote"), locale, "owner-consent");
    await fresh.close();

    const owner = await newContext(locale);
    const list = await signIn(owner, "ownerA", "/vote");
    // Start at an open meeting, as an owner sees it on a voting day.
    const m1Card = list.getByText("DEMO M1", { exact: false }).first();
    await m1Card.scrollIntoViewIfNeeded();
    await m1Card.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 140));
    await save(list, locale, "owner-vote-list");

    const ballot = await owner.newPage();
    await ballot.goto(`${appUrl}/vote/${m1.id}/${room.id}`);
    await ballot.waitForLoadState("networkidle");
    await save(ballot, locale, "owner-ballot");

    await ballot.goto(`${appUrl}/vote/${m8.id}/${room.id}`);
    await ballot.waitForLoadState("networkidle");
    await ballot
      .getByRole("heading", { name: locale === "th" ? "ประวัติการลงคะแนน" : /history/i })
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await save(ballot, locale, "owner-ballot-history");

    const summary = await owner.newPage();
    await summary.goto(`${appUrl}/summary`);
    await summary.waitForLoadState("networkidle");
    await save(summary, locale, "owner-summary");
    await owner.close();
  }
}

async function pdfs() {
  for (const locale of LOCALES) {
    const context = await newContext(locale, { viewport: { width: 1000, height: 1400 } });
    const page = await context.newPage();
    await page.goto(`${appUrl}/help/owner?print=1`);
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    const file = path.join(root, "public", "help", `owner-quick-guide-${locale}.pdf`);
    await page.pdf({ path: file, format: "A4", printBackground: false, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
    console.log(`[help] owner-quick-guide-${locale}.pdf`);
    await context.close();
  }
}

try {
  if (process.argv.includes("--pdf")) {
    await pdfs();
  } else {
    await screenshots();
  }
} finally {
  await browser.close();
}
