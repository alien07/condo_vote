// Writes .env.local for e2e tests against the local Supabase stack.
// Usage: npm run supabase:start && npm run env:test
// Keeps existing values, refreshes Supabase URL/keys, and fills test defaults
// only when missing. Works on Windows, macOS, Linux, and CI.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).replace(/^export\s+/, "");
        const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

function readSupabaseStatus() {
  // execSync runs through a shell, so `npx` resolves to npx.cmd on Windows.
  const output = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseEnv(output);
}

const status = readSupabaseStatus();
const anonKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;

if (!status.API_URL || !anonKey || !secretKey) {
  console.error("[env:test] Supabase is not running. Run `npm run supabase:start` first.");
  process.exit(1);
}

const existing = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
const testDefaults = {
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  APP_CANONICAL_URL: "http://127.0.0.1:3000",
  ENABLE_LOCAL_AUTH_BYPASS: "1",
  LOCAL_AUTH_BYPASS_EMAIL: "demo.admin@example.test",
  LOCAL_AUTH_BYPASS_NAME: "Demo Admin",
};
const next = {
  ...testDefaults,
  ...existing,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SECRET_KEY: secretKey,
};

writeFileSync(
  envPath,
  `${Object.entries(next)
    .map(([key, value]) => `${key}=${/\s/.test(value) ? `"${value}"` : value}`)
    .join("\n")}\n`,
);
console.log(`[env:test] wrote ${envPath} (${Object.keys(next).length} keys)`);
