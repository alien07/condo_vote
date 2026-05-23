# Testing

This document defines the robot test plan and re-test tags for condoVotes.

## Current Status
Robot tests are not implemented yet.

Current verification is manual/command-based:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run db:reset:local`
- `npm run types:supabase`
- Browser smoke check for `/`, `/login`, `/admin`, `/vote`

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
Recommended tool: Playwright.

Scope:
- App shell loads.
- Browser title shows `condoVotes v<version>`.
- Routes `/`, `/login`, `/admin`, `/vote` render.
- Auth redirect behavior when implemented.
- Admin guard behavior when implemented.

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

1. Add Playwright smoke tests first because the app currently has route shells.
2. Add Vitest when pure domain logic starts to exist.
3. Add database smoke checks after the first RLS policies are written.
4. Add GitHub Actions once local scripts are stable.

## Open Questions
- Should E2E tests run against local Supabase Docker by default or a mocked auth state first?
- Should migration smoke tests be required before every push or only before pull requests?
