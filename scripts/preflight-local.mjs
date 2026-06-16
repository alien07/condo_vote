import { existsSync, readFileSync } from "node:fs";

const envPath = ".env.local";
const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const optionalEnv = [
  "NEXT_PUBLIC_APP_URL",
  "APP_CANONICAL_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function readEnvFile() {
  if (!existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");

        if (separator < 0) {
          return [line, ""];
        }

        const key = line.slice(0, separator).replace(/^export\s+/, "");
        const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");

        return [key, value];
      }),
  );
}

function envValue(env, key) {
  return process.env[key] || env[key] || "";
}

function printStatus(label, ok, detail = "") {
  const icon = ok ? "OK" : "FAIL";
  console.log(`[preflight:${icon}] ${label}${detail ? ` - ${detail}` : ""}`);
}

function printWarning(label, detail = "") {
  console.log(`[preflight:WARN] ${label}${detail ? ` - ${detail}` : ""}`);
}

async function checkFetch(label, url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      printStatus(label, false, `HTTP ${response.status}`);
      return false;
    }

    printStatus(label, true);
    return true;
  } catch (error) {
    clearTimeout(timeout);
    printStatus(
      label,
      false,
      error?.name === "AbortError" ? "timeout" : error?.message ?? "unreachable",
    );
    return false;
  }
}

async function main() {
  if (process.env.SKIP_DEV_PREFLIGHT === "1") {
    console.log("[preflight:SKIP] SKIP_DEV_PREFLIGHT=1");
    return;
  }

  const fileEnv = readEnvFile();
  const missing = requiredEnv.filter((key) => !envValue(fileEnv, key));
  const warnings = optionalEnv.filter((key) => !envValue(fileEnv, key));

  if (!existsSync(envPath)) {
    printStatus(".env.local", false, "file not found");
    console.error("Run npm run demo:configure:local after Supabase is started.");
    process.exit(1);
  }

  if (missing.length > 0) {
    missing.forEach((key) => printStatus(`env ${key}`, false, "missing"));
    console.error("Run npm run demo:configure:local or update .env.local.");
    process.exit(1);
  }

  requiredEnv.forEach((key) => printStatus(`env ${key}`, true));
  warnings.forEach((key) => printWarning(`env ${key}`, "optional missing"));

  const supabaseUrl = envValue(fileEnv, "NEXT_PUBLIC_SUPABASE_URL").replace(
    /\/$/,
    "",
  );
  const anonKey = envValue(fileEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const authOk = await checkFetch(
    "Supabase Auth",
    `${supabaseUrl}/auth/v1/health`,
  );
  const restOk = await checkFetch("Supabase REST", `${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!authOk || !restOk) {
    console.error(
      "Local Supabase is not ready. Run: npm run supabase:start -- --exclude edge-runtime --ignore-health-check",
    );
    process.exit(1);
  }

  console.log("[preflight:OK] local app dependencies are ready");
}

main().catch((error) => {
  console.error("[preflight:FAIL] unexpected error", error);
  process.exit(1);
});
