import type { Browser } from "playwright-core";

// Headless Chromium for the master PDF files (D021). On Vercel it uses the
// serverless Chromium build; elsewhere the Chromium that Playwright installed
// (PLAYWRIGHT_BROWSERS_PATH) or CHROMIUM_EXECUTABLE_PATH.
export async function launchPdfBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");

  if (process.env.VERCEL) {
    const serverless = (await import("@sparticuz/chromium")).default;

    return chromium.launch({
      args: serverless.args,
      executablePath: await serverless.executablePath(),
      headless: true,
    });
  }

  return chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
}
