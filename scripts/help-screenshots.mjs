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
const GUIDES = ["owner", "committee"];
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

// Scroll an element near the top of the phone screen, under the header.
async function scrollToTop(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 140));
}

// Open a <details> (a folded form) and bring it into view.
async function openDetails(locator) {
  await locator.evaluate((element) => {
    element.open = true;
  });
  await scrollToTop(locator);
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

  // A signed-in person's saved language wins over the lang cookie (D020),
  // so each persona is switched to the language being shot, then put back.
  const personaEmails = [
    "owner.th.2rooms-proxy@example.test",
    "committee.approve@example.test",
    "new.pending-consent@example.test",
  ];
  const { data: savedLanguages } = await db
    .from("profiles")
    .select("email, preferred_language")
    .in("email", personaEmails);
  const setLanguage = async (locale) => {
    const { error } = await db.from("profiles").update({ preferred_language: locale }).in("email", personaEmails);

    if (error) {
      throw new Error(`language: ${error.message}`);
    }
  };

  try {
    for (const locale of LOCALES) {
      await setLanguage(locale);
      await shootLocale(locale, { m1, m8, room });
    }
  } finally {
    // The new user's profile is made during the run; the seed language is Thai.
    await setNewUserLanguage("th");
    for (const row of savedLanguages ?? []) {
      await db.from("profiles").update({ preferred_language: row.preferred_language }).eq("email", row.email);
    }
  }
}

async function shootLocale(locale, { m1, m8, room }) {
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
  const consent = await signIn(fresh, "newUser", "/vote");
  // The first sign-in creates the profile; give it this language and reload.
  await setNewUserLanguage(locale);
  await consent.reload();
  await consent.waitForLoadState("networkidle");
  await save(consent, locale, "owner-consent");
  await fresh.close();

  const owner = await newContext(locale);
  const list = await signIn(owner, "ownerA", "/vote");
  // Start at an open meeting, as an owner sees it on a voting day.
  await scrollToTop(list.getByText("DEMO M1", { exact: false }).first());
  await save(list, locale, "owner-vote-list");

  // The folded "let my co-owner vote" form under a room the owner holds.
  await openDetails(list.locator("details[data-co-owner]").first());
  await save(list, locale, "owner-co-owner");

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

  // Committee guide: the Committee page as a committee member sees it.
  const committee = await newContext(locale);
  const board = await signIn(committee, "committee", "/committee");
  await save(board, locale, "committee-page");

  await openDetails(board.locator('section[aria-labelledby="committee-step-close"] details').first());
  await save(board, locale, "committee-close-propose");

  const result = board.locator("[data-result-snapshot-id]").first();
  await scrollToTop(result);
  await save(board, locale, "committee-result");

  await openDetails(result.locator("details").first());
  await save(board, locale, "committee-correction");
  await committee.close();
}

// The new-user persona has no profile until its first sign-in.
async function setNewUserLanguage(locale) {
  const env = readEnv();
  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await db.from("profiles").update({ preferred_language: locale }).eq("email", "new.pending-consent@example.test");
}

async function pdfs() {
  for (const guide of GUIDES) {
    for (const locale of LOCALES) {
      const context = await newContext(locale, { viewport: { width: 1000, height: 1400 } });
      const page = await context.newPage();
      await page.goto(`${appUrl}/help/${guide}?print=1`);
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      const file = path.join(root, "public", "help", `${guide}-quick-guide-${locale}.pdf`);
      await page.pdf({ path: file, format: "A4", printBackground: false, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
      console.log(`[help] ${guide}-quick-guide-${locale}.pdf`);
      await context.close();
    }
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
