// Picks the e2e spec files to run as a smoke test for the changed files.
// Usage: node scripts/select-e2e-specs.mjs <base-ref>
// Prints space-separated spec paths, or "ALL" when shared code changed.
// See docs/development-workflow.md (CI gate).
import { execSync } from "node:child_process";

const base = process.argv[2] || "origin/dev";
const changed = execSync(`git diff --name-only ${base}...HEAD`, { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const SPEC = {
  shell: "tests/e2e/app-shell.spec.ts",
  roles: "tests/e2e/role-access.spec.ts",
  vote: "tests/e2e/vote-flow.spec.ts",
  admin: "tests/e2e/admin-demo.spec.ts",
  tables: "tests/e2e/table-search.spec.ts",
  privacy: "tests/e2e/privacy.spec.ts",
  language: "tests/e2e/language.spec.ts",
};

// Shared code: any change here runs the full suite.
const runAll = [
  /^package(-lock)?\.json$/,
  /^playwright\.config\.ts$/,
  /^next\.config\.ts$/,
  /^proxy\.ts$/,
  /^tsconfig\.json$/,
  /^app\/(layout\.tsx|globals\.css|page\.tsx)$/,
  /^lib\/(supabase|app-config|error-codes)/,
  /^supabase\//,
  /^\.github\/workflows\//,
  /^scripts\/(write-test-env|select-e2e-specs|preflight-local)\.mjs$/,
];

// Domain rules: changed path -> specs that cover that feature.
const rules = [
  [/^tests\/e2e\/(.+\.spec\.ts)$/, (m) => [`tests/e2e/${m[1]}`]],
  [/^(app\/(vote|summary)|features\/(voting|summary))\//, () => [SPEC.vote]],
  [/^(app\/(auth|login)|features\/(auth|shell)|lib\/auth)\//, () => [SPEC.roles, SPEC.privacy, SPEC.language]],
  [/^(app\/(consent|system)|features\/privacy)\//, () => [SPEC.privacy]],
  [/^(app\/committee|features\/(committee|results))\//, () => [SPEC.roles, SPEC.admin]],
  [/^features\/admin\/components\/(table-controls|sections\/shared)/, () => [SPEC.tables]],
  [/^(app\/admin|app\/api\/admin|features\/admin|lib\/audit)\//, () => [SPEC.admin, SPEC.roles]],
  [/^(features\/debug|components)\//, () => [SPEC.admin]],
  [/^(lib|features)\/i18n\//, () => [SPEC.language, SPEC.vote, SPEC.privacy]],
  [/^features\/email\//, () => [SPEC.admin]],
];

const selected = new Set([SPEC.shell]);
let all = false;

for (const file of changed) {
  if (runAll.some((re) => re.test(file))) {
    all = true;
    break;
  }
  for (const [re, specs] of rules) {
    const match = file.match(re);
    if (match) specs(match).forEach((spec) => selected.add(spec));
  }
}

console.log(all ? "ALL" : [...selected].join(" "));
