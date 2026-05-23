# Local Development

## Project Name
Display name: `condoVotes`

Package name: `condovotes`

Technical IDs: `condovotes`

The npm package name and Supabase local `project_id` are lowercase for tooling/container compatibility. Use `condoVotes` for app display text and product naming.

## Versioning
Use Semantic Versioning:
- `MAJOR`: incompatible product or API changes.
- `MINOR`: backward-compatible features.
- `PATCH`: backward-compatible fixes.

Current version is read from `package.json` and shown in the browser title as `condoVotes v<version>`.

Use `npm version patch`, `npm version minor`, or `npm version major` when intentionally bumping the app version.

## Supabase Local Stack
Use the Supabase CLI with Docker for local development. Supabase official docs describe the CLI local stack as Docker-based and recommend local migrations before pushing to a linked Supabase project.

Prerequisites:
- Docker Desktop, OrbStack, Rancher Desktop, or another Docker-compatible runtime.
- Supabase CLI installed as a project dev dependency.

Commands:

```bash
npm run supabase:start
npm run db:reset:local
npm run types:supabase
npm run supabase:status
npm run supabase:stop
```

Local Studio is normally available at:

```text
http://localhost:54323
```

## Migrate To Dev Supabase Project
Do not commit Supabase project refs, database passwords, access tokens, or service role keys.

One-time setup per developer machine:

```bash
npx supabase login
npx supabase link --project-ref <dev-project-ref>
```

Preview migrations before pushing:

```bash
npm run db:push:dev:dry
```

Apply migrations to the linked dev project:

```bash
npm run db:push:dev
```

After schema changes:

```bash
npm run db:reset:local
npm run types:supabase
```

## Local Demo Admin
Use only ignored local environment files for demo credentials and keys.

After `npm run supabase:start`, add the local Supabase URL, publishable key, and secret key to `.env.local`. Do not commit `.env.local`.

Grant a local demo admin:

```bash
npm run admin:grant:local -- prajak.ma@gmail.com "Demo Admin"
```

Local demo URLs:

```text
App: http://localhost:3000
Supabase Studio: http://localhost:54323
Mailpit: http://localhost:54324
```

Machines on the same Wi-Fi can use the `Network` URL printed by `npm run dev`.

## References
- Supabase local development docs: https://supabase.com/docs/guides/cli
- Supabase schema migration docs: https://supabase.com/docs/guides/cli/local-development
- Supabase CLI reference: https://supabase.com/docs/reference/cli/getting-started
