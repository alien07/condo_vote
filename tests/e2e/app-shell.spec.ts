import { expect, test } from "@playwright/test";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";

test.describe("@test:e2e app shell", () => {
  test("home page shows app name, version, and route links", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(`${APP_NAME} v${APP_VERSION}`);
    await expect(page.getByRole("heading", { name: APP_NAME })).toBeVisible();
    await expect(page.getByText(`workspace v${APP_VERSION}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" })).toHaveAttribute(
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

  test("primary placeholder routes render", async ({ page }) => {
    const routes = [
      {
        path: "/login",
        heading: "Login",
        text: `Sign in with Google or email magic link. Version ${APP_VERSION}.`,
      },
      {
        path: "/admin",
        heading: "Admin",
        text: "Room, owner, meeting, approval, and result management.",
      },
      {
        path: "/vote",
        heading: "Vote",
        text: "Eligible owners and approved proxies will vote from this area.",
      },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expect(page.getByText(route.text)).toBeVisible();
    }
  });
});
