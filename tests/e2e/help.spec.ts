import { expect, test } from "@playwright/test";

// The help pages are public: owners who cannot sign in still need them.
test.describe("help", () => {
  test("lists the owner guide and opens it without signing in", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Help", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /How to vote online/ }).click();

    await expect(page).toHaveURL(/\/help\/owner$/);
    await expect(page.getByRole("heading", { name: "How to vote online" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sign in with Google/ })).toBeVisible();
    await expect(page.getByText("Frequently asked questions").first()).toBeVisible();

    const screenshot = page.getByRole("img", { name: "Sign in with Google" });
    await expect(screenshot).toBeVisible();
    expect(await screenshot.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test("shows Thai by default", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/help/owner");
    await expect(page.getByRole("heading", { name: "วิธีลงคะแนนออนไลน์" })).toBeVisible();
    await context.close();
  });

  test("the quick guide PDF is published", async ({ request }) => {
    for (const locale of ["th", "en"]) {
      const response = await request.get(`/help/owner-quick-guide-${locale}.pdf`);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("pdf");
    }
  });

  test("the sign-in page links the owner guide", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "How to vote online" }).click();
    await expect(page).toHaveURL(/\/help\/owner$/);
  });

  test("unknown guides return 404", async ({ request }) => {
    const response = await request.get("/help/does-not-exist");
    expect(response.status()).toBe(404);
  });
});
