# Testing

This document defines the robot test plan and re-test tags for condoVotes.

## Current Status
Robot tests are implemented with Playwright E2E coverage.

Current verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
- Targeted auth/admin checks:
  `npx playwright test tests/e2e/app-shell.spec.ts tests/e2e/role-access.spec.ts --project=chromium`
- Targeted owner/proxy voting checks:
  `npx playwright test tests/e2e/vote-flow.spec.ts --project=chromium`
- Admin demo flow:
  `npx playwright test tests/e2e/admin-demo.spec.ts --project=chromium`
- Database checks when schema changes:
  `npm run db:reset:local`
  `npm run types:supabase`

## Test Layers

### Unit Tests
Recommended tool: Vitest.

Scope:
- Pure helpers.
- Role and permission helpers with mocked Supabase responses.
- Result calculation helpers when implemented.
- Email queue ordering logic when implemented.

Target command:

```bash
npm run test:unit
```

### E2E Tests
Tool: Playwright.

Scope:
- App shell loads.
- Browser title shows `condoVotes v<version>`.
- Routes `/`, `/login`, `/admin`, `/vote` render.
- Signed-out protected routes redirect to `/login`.
- Local generated-link auth can establish a session.
- Admin can access admin, vote, and summary pages.
- Resident cannot access admin pages and can access summary.
- Owner/proxy voters can submit and edit ballots, creating ballot versions.
- Authenticated pages show profile identity, top navigation, breadcrumbs, and logout.
- Demo admin can exercise master data, private document registry, business audit, meeting, manual vote, result, approval, and Excel import flows.

Target command:

```bash
npm run test:e2e
```

### Database Tests
Recommended tool: Supabase CLI plus SQL smoke checks.

Scope:
- Local Docker Supabase starts.
- Migrations apply with `db reset`.
- Generated database types are up to date.
- RLS is enabled on public tables.
- Seed data uses synthetic data only.

Target commands:

```bash
npm run db:reset:local
npm run types:supabase
```

### CI Tests
Recommended tool: GitHub Actions.

Scope:
- Dependency install.
- Lint.
- Typecheck.
- Build.
- Unit tests when available.
- E2E smoke tests when available.

Workflow:
- `.github/workflows/ci.yml`
- Runs on push and pull request targeting `dev`.

Target command group:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
```

## Re-Test Tags

Use these tags in PR notes, commits, or task summaries to choose what to re-run.

| Tag | Meaning | Run |
| --- | --- | --- |
| `@test:lint` | Code style/static lint changed. | `npm run lint` |
| `@test:typecheck` | TypeScript types or generated types changed. | `npm run typecheck` |
| `@test:build` | Next.js app, routing, config, or package changed. | `npm run build` |
| `@test:unit` | Pure logic/helper behavior changed. | `npm run test:unit` |
| `@test:e2e` | User-visible routes, auth flow, or browser behavior changed. | `npm run test:e2e` |
| `@test:db` | Supabase migration, seed, RLS, or schema docs changed. | `npm run db:reset:local` and `npm run types:supabase` |
| `@test:auth` | Login, session, profile bootstrap, or role guard changed. | `@test:typecheck`, `@test:e2e`, `@test:db` if schema changed |
| `@test:admin` | Admin pages or admin permissions changed. | `@test:typecheck`, `@test:e2e`, `@test:auth` |
| `@test:voting` | Meeting eligibility, ballot, or vote flow changed. | `@test:unit`, `@test:e2e`, `@test:db` |
| `@test:results` | Result calculation, approval, PDF, or result visibility changed. | `@test:unit`, `@test:e2e`, `@test:db` |
| `@test:email` | Email queue, notification, or delivery logging changed. | `@test:unit`, `@test:db` |
| `@test:audit` | Business audit entries or audit visibility changed. | `@test:typecheck`, `@test:e2e`, `@test:db` |
| `@test:documents` | Document registry, storage settings, or provider metadata changed. | `@test:typecheck`, `@test:e2e`, `@test:db` |
| `@test:all` | Broad or risky change. | lint, typecheck, build, unit, e2e, db |

## Default Re-Test Selection

When unsure, run:

```bash
npm run lint
npm run typecheck
npm run build
```

Run database tests when any of these paths change:
- `supabase/**`
- `docs/schema-draft.sql`
- `lib/supabase/database.types.ts`

Run e2e tests when any of these paths change:
- `app/**`
- `components/**`
- `features/**`
- `next.config.ts`

Run unit tests when any of these paths change:
- `lib/**`
- `features/**`

## Implementation Order

1. Expand Playwright coverage for closed-meeting summary redirects.
2. Add Vitest when pure domain logic is split out of server actions.
3. Add database smoke checks for RLS policy coverage.
4. Add GitHub Actions once local scripts are stable.

## Open Questions
- Should E2E tests run against local Supabase Docker by default or a mocked auth state first?
- Should migration smoke tests be required before every push or only before pull requests?
