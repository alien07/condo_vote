// Environment, database client and shared helpers. Runs first.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createJiti } from "jiti";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const args = new Set(process.argv.slice(2));
// jiti loads the app's TypeScript, so results are built by the same code as
// "Generate result" (features/results/snapshot-payload.ts).
export const jiti = createJiti(import.meta.url, { alias: { "@": root } });
export const tsModule = (file) => jiti.import(pathToFileURL(path.join(root, file)).href);
export const { DEMO_PERSONAS, DEMO_SYSTEM_ADMIN } = await tsModule("lib/demo/personas.ts");
export const { buildResultPayload } = await tsModule("features/results/snapshot-payload.ts");
// English for the demo content, the same list the demo translator uses (6b).
export const { DEMO_TRANSLATIONS } = await tsModule("lib/translation/demo-translations.ts");
export const en = (thai) => (thai ? (DEMO_TRANSLATIONS[thai] ?? null) : null);

// ---------------------------------------------------------------- env

export function readEnvFile(file) {
  if (!fs.existsSync(file)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).replace(/^export\s+/, ""),
          line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

export const fileEnv = readEnvFile(path.join(root, ".env.local"));
export const env = (key) => process.env[key] || fileEnv[key];
export const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
export const serviceKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
export const anonKey =
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export function fail(message) {
  console.error(`[demo:seed] ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !serviceKey || !anonKey) {
  fail("Missing Supabase URL or keys. Run `npm run supabase:start && npm run env:test`.");
}

export const supabaseHost = new URL(supabaseUrl).hostname;

if (!/^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(supabaseHost)) {
  fail(`Refusing to seed a non-local Supabase (${supabaseHost}).`);
}

if (args.has("--reset")) {
  console.log("[demo:seed] supabase db reset ...");
  const reset = spawnSync("npx supabase db reset", { cwd: root, shell: true, stdio: "inherit" });

  if (reset.status !== 0) {
    fail("supabase db reset failed.");
  }
}

export const authOptions = { auth: { autoRefreshToken: false, persistSession: false } };
export const db = createClient(supabaseUrl, serviceKey, authOptions);

// ---------------------------------------------------------------- helpers

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const NOW = Date.now();
export const at = (offsetMs) => new Date(NOW + offsetMs).toISOString();
export const dateOnly = (offsetMs) => at(offsetMs).slice(0, 10);

export async function must(promise, label) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

let knownUsers = null;

export async function listAllUsers() {
  const users = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 200) {
      return users;
    }
  }
}

export async function ensureAuthUser(email, fullName) {
  knownUsers ??= await listAllUsers();
  const found = knownUsers.find((user) => user.email?.toLowerCase() === email);

  if (found) {
    return found;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    throw new Error(`create user ${email}: ${error.message}`);
  }

  knownUsers.push(data.user);
  return data.user;
}

/** Upserts an approved profile by email; links the auth user when given. */
export async function upsertProfile({ email, fullName, defaultStatus, language, authUserId }) {
  const existing = await must(
    db.from("profiles").select("id, full_name").ilike("email", email).limit(1),
    `profile ${email}`,
  );
  const values = {
    email,
    full_name: fullName ?? existing[0]?.full_name ?? email,
    approval_status: "approved",
    default_status: defaultStatus,
    preferred_language: language,
    ...(authUserId ? { auth_user_id: authUserId } : {}),
  };

  if (existing[0]) {
    await must(db.from("profiles").update(values).eq("id", existing[0].id), `profile ${email}`);
    return existing[0].id;
  }

  const created = await must(
    db.from("profiles").insert(values).select("id").single(),
    `profile ${email}`,
  );
  return created.id;
}

export async function grantRoles(profileId, roles) {
  if (roles.length > 0) {
    await must(
      db
        .from("app_roles")
        .upsert(roles.map((role) => ({ profile_id: profileId, role })), {
          onConflict: "profile_id,role",
        }),
      "app_roles",
    );
  }
}

/** A client signed in as `email`, for RPCs that check auth.uid(). */
export async function sessionFor(email) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });

  if (error) {
    throw new Error(`magic link ${email}: ${error.message}`);
  }

  const client = createClient(supabaseUrl, anonKey, authOptions);
  const verified = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verified.error) {
    throw new Error(`sign in ${email}: ${verified.error.message}`);
  }

  return client;
}

// After `db reset` the API restarts and reloads its schema cache; wait for it.
for (let attempt = 1; ; attempt += 1) {
  const { error } = await db.from("meetings").select("id").limit(1);

  if (!error) {
    break;
  }

  if (attempt >= 60) {
    fail(`Supabase API is not ready: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export const existingDemo = await must(
  db.from("meetings").select("id").like("title", "DEMO %").limit(1),
  "check existing demo",
);

if (existingDemo.length > 0) {
  fail("Demo data already exists. Run `npm run demo:seed -- --reset` for a fresh copy.");
}
