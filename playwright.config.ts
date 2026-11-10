import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    // Most specs read the English copy; owner pages default to Thai (D020).
    // Language specs clear this cookie to test the Thai default.
    storageState: {
      cookies: ["127.0.0.1", "localhost"].map((domain) => ({
        name: "lang",
        value: "en",
        domain,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
      origins: [],
    },
  },
  webServer: {
    // Cross-platform: set NODE_OPTIONS through env, not POSIX shell syntax.
    command: "npm run dev",
    env: {
      NODE_OPTIONS: "--max-old-space-size=8192",
    },
    url: "http://127.0.0.1:3000",
    // First `next dev` compile on CI runners can take longer than the 60s default.
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
