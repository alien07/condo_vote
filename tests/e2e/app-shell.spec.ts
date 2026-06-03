import { expect, test } from "@playwright/test";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";

test.describe("@test:e2e app shell", () => {
  test("home page shows app name, version, and route links", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");

    await expect(page).toHaveTitle(`${APP_NAME} v${APP_VERSION}`);
    await expect(page.getByRole("heading", { name: APP_NAME })).toBeVisible();
    await expect(page.getByText(`workspace v${APP_VERSION}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(page.getByRole("link", { name: /Admin/ })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(page.getByRole("link", { name: /Vote/ })).toHaveAttribute(
      "href",
      "/vote",
    );
  });

  test("login route renders", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByText(`Sign in with Google. Version ${APP_VERSION}.`),
    ).toBeVisible();
  });

  test("0.0.0.0 redirects to the canonical laptop host", async ({ request }) => {
    const response = await request.get("http://127.0.0.1:3000/login", {
      headers: {
        host: "0.0.0.0:3000",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("http://127.0.0.1:3000/login");
  });

  test("@test:auth protected routes redirect signed-out users", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    for (const path of [
      "/admin",
      "/admin/setup",
      "/admin/meetings",
      "/admin/voting",
      "/admin/results",
      "/admin/communications",
      "/admin/people",
      "/admin/ownership",
      "/admin/proxies",
      "/vote",
      "/summary",
    ]) {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    }
  });
});
