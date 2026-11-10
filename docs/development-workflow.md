# Development Workflow

Status: accepted. This is the standard flow for every change in condoVotes,
for people and AI agents alike.

```text
Plan -> Branch -> Code -> Local check -> Commit -> PR -> CI gate -> Review -> Merge -> Release/Deploy
```

Each step lists what is required. Items marked **(to set up)** are part of the
standard but the tooling is not in place yet; see [Setup Backlog](#setup-backlog).

## 1. Plan
- Every change starts from a GitHub issue with acceptance criteria.
- Label the issue with its domain (see [code-organization.md](code-organization.md))
  and the expected re-test tags (see [testing.md](testing.md#re-test-tags)).
- A design choice that is hard to reverse is recorded in
  [decisions.md](decisions.md) before coding starts.
- If a requirement, schema, or legal rule is unclear, ask first
  (see [AGENTS.md](../AGENTS.md) working rules).

## 2. Branch
- Branch from `dev`. One branch covers one topic.
- Name: `<type>/<short-topic>`, where type is `feat`, `fix`, `refactor`,
  `docs`, `chore`, or `test`. Example: `fix/ballot-multi-voter-room`.
- Keep the diff small, about 400 changed lines or less, excluding generated
  files. Split larger work into several PRs.

## 3. Code
- Follow [code-organization.md](code-organization.md): domain modules, files of
  400 lines or less, split above 600.
- Migrations are additive. Never edit a migration that is already merged; add
  a new one.
- After any schema change, run `npm run db:reset:local` and
  `npm run types:supabase`, and commit the generated types.
- Use synthetic data only in seeds, tests, screenshots, and docs.
- Format code with Prettier **(to set up)**.

## 4. Local Check
Before every push, run and pass:

```bash
npm run lint
npm run typecheck
npm run build
```

Also run the checks named by the change's re-test tags, for example
`npm run test:unit` **(to set up)**, `npm run test:e2e`, or
`npm run db:reset:local`.

A pre-commit hook (husky + lint-staged) formats and lints changed files
**(to set up)**.

## 5. Commit
- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, `chore: ...`,
  `test: ...`. Add a scope when useful, for example `fix(voting): ...`.
- Each commit should build on its own.
- Put re-test tags such as `@test:voting` in the commit body or the PR.
- Never commit secrets, `.env*` files (except `.env.example`), or real
  resident data.

## 6. Pull Request
- Open a PR into `dev`. Open it as a draft early when feedback helps.
- Fill in the [PR template](../.github/pull_request_template.md): what and why,
  how it was tested, re-test tags, screenshots for UI changes, migration
  notes, and rollback plan.
- Link the issue (`Closes #123`).

## 7. CI Gate
All checks must pass before merge:

| Check | Status |
| --- | --- |
| Lint | in CI |
| Typecheck | in CI |
| Build | in CI |
| E2E smoke test for changed features, against local Supabase | in CI |
| Unit tests (Vitest) | to set up |
| Migration check (`db reset` and generated types diff) | to set up |
| Secret scan (gitleaks) | to set up |
| Dependency audit | to set up |

E2E in the CI gate is a smoke test of the features the PR changes, not the
full suite:
- `scripts/select-e2e-specs.mjs` maps changed paths to spec files and always
  adds the app shell test (`tests/e2e/app-shell.spec.ts`).
- Smoke runs skip tests tagged `@full` (long end-to-end flows):
  `npm run test:e2e:smoke`.
- The full suite, including `@full`, runs when shared code changes, or on
  demand from GitHub Actions ("Run workflow" on CI, `full` = true):
  `npm run test:e2e`.

## 8. Review
- Self-review the diff first.
- At least one reviewer approves. A Claude code review can be the first pass,
  but a person approves.
- Use the review checklist in the PR template: RLS and permissions, personal
  data (PDPA), audit logging, result calculation correctness, and docs updated.

## 9. Merge
- Squash merge into `dev` after CI is green and the PR is approved.
- Delete the branch after merge.
- No branch protection on `dev` (decided 2026-11-08). Whoever merges,
  person or agent, checks that CI is green first. Never merge a red or
  still-running PR.

## 10. Release And Deploy
- Every PR gets a preview deployment on the non-production Supabase project
  **(to set up)**.
- Release by opening a PR from `dev` into `main` **(to set up: `main` branch)**.
- Bump the version with `npm version patch|minor|major` and update the
  changelog.
- Apply database migrations before deploying the app.
- After deploy, run a smoke test: login, vote page, summary page.
- Every release has a written rollback plan. App rollback: redeploy the
  previous version. Database: forward-fix with a new migration.

## Voting-System Rules
These apply on top of the steps above.
- **Deploy freeze:** no production deploy from a meeting's `starts_at` until
  its result is approved, except a hotfix that follows the incident runbook.
- **Result calculation:** any change to quorum, thresholds, weighting, or
  result snapshots needs unit tests with hand-calculated expected values.
- **RLS and migrations:** changes need two reviews, or one review plus a
  documented RLS test.
- **Legal rules:** changes based on the Condominium Act or the electronic
  meeting decree cite their source in `docs/` and note whether a lawyer
  confirmed them.

## Definition Of Done
- Acceptance criteria met.
- Local checks and CI pass.
- Tests added or updated for changed behavior.
- Docs and decisions updated when behavior, schema, or rules change.
- Reviewed, approved, and squash merged.

## Setup Backlog
Set up in this order (highest value first):
1. ~~Fix CI e2e smoke tests~~ (done in #3).
2. Prettier, husky + lint-staged, and Conventional Commits check.
3. Vitest, starting with result calculation.
4. Review checklist adoption (template added with this document).
5. `main` branch, release flow, and preview deployments.
6. Secret scan, migration check, and dependency audit in CI.
