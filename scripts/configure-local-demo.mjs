import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";

const appPort = process.env.APP_PORT || "3000";
const supabasePort = process.env.SUPABASE_API_PORT || "54321";
const ipAddress = process.env.DEMO_LAN_IP || detectLanIp();

if (!ipAddress) {
  console.error("Could not detect a LAN IPv4 address. Set DEMO_LAN_IP manually.");
  process.exit(1);
}

const appUrl = `http://${ipAddress}:${appPort}`;
const authUrl = `http://127.0.0.1:${supabasePort}/auth/v1`;
const envValues = readSupabaseEnv();

writeLocalEnv({
  NEXT_PUBLIC_SUPABASE_URL: envValues.API_URL ?? `http://127.0.0.1:${supabasePort}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: envValues.PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: appUrl,
  SUPABASE_SECRET_KEY: envValues.SECRET_KEY,
});

writeSupabaseConfig({ appUrl, authUrl });

console.log(`Demo LAN IP: ${ipAddress}`);
console.log(`App: ${appUrl}`);
console.log(`Mailpit: http://${ipAddress}:54324`);
console.log(`Supabase Auth callback: ${authUrl}/callback`);
console.log("Restart Supabase after this script when config.toml changed.");

function detectLanIp() {
  const interfaces = os.networkInterfaces();

  for (const details of Object.values(interfaces)) {
    for (const detail of details ?? []) {
      if (
        detail.family === "IPv4" &&
        !detail.internal &&
        isPrivateIpv4(detail.address)
      ) {
        return detail.address;
      }
    }
  }

  return null;
}

function isPrivateIpv4(value) {
  return (
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

function readSupabaseEnv() {
  try {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return Object.fromEntries(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf("=");
          const key = line.slice(0, separator).replace(/^export\s+/, "");
          const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}

function writeLocalEnv(values) {
  const existing = existsSync(".env.local")
    ? Object.fromEntries(
        readFileSync(".env.local", "utf8")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
          .map((line) => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
          }),
      )
    : {};

  const next = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(values).filter((entry) => Boolean(entry[1])),
    ),
  };

  writeFileSync(
    ".env.local",
    `${Object.entries(next)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
}

function writeSupabaseConfig({ appUrl, authUrl }) {
  const configPath = "supabase/config.toml";
  let config = readFileSync(configPath, "utf8");
  const redirectUrls = [
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3000/auth/callback",
    "http://localhost:3000",
    "http://localhost:3000/auth/callback",
    appUrl,
    `${appUrl}/auth/callback`,
  ];

  config = config.replace(/^site_url = ".*"$/m, `site_url = "${appUrl}"`);

  if (/^external_url = ".*"$/m.test(config)) {
    config = config.replace(
      /^external_url = ".*"$/m,
      `external_url = "${authUrl}"`,
    );
  } else {
    config = config.replace(
      /^# external_url = ""$/m,
      `external_url = "${authUrl}"`,
    );
  }

  config = config.replace(
    /^additional_redirect_urls = \[[\s\S]*?\]\n# How long tokens/m,
    `additional_redirect_urls = [\n${redirectUrls
      .map((url) => `  "${url}",`)
      .join("\n")}\n]\n# How long tokens`,
  );

  writeFileSync(configPath, config);
}
