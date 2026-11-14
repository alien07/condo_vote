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

## Start And Stop In One Command
For live tests and demos on this computer. Each script brings up Docker,
the Supabase local stack, and the app, and waits until each one answers.

| | Windows | macOS / Linux |
|---|---|---|
| Start | `scripts\local\start-local.bat` (double-click works) | `./scripts/local/start.sh` |
| Start + fresh demo data | `scripts\local\start-local.bat -Seed` | `./scripts/local/start.sh --seed` |
| Use `next dev` | `scripts\local\start-local.bat -Dev` | `./scripts/local/start.sh --dev` |
| Force a rebuild | `scripts\local\start-local.bat -Build` | `./scripts/local/start.sh --build` |
| Stop app + Supabase | `scripts\local\stop-local.bat` | `./scripts/local/stop.sh` |
| Stop only the app | `scripts\local\stop-local.bat -AppOnly` | `./scripts/local/stop.sh --app-only` |

- Start runs the production build with the demo sign-in buttons on
  (`ENABLE_LOCAL_AUTH_BYPASS=1`, local only). It rebuilds only when the
  commit or tracked files changed since the last local build.
- `-Seed` wipes the local database (`scripts/seed-demo.mjs --reset --consent`).
- Windows: the server runs in its own window titled `condoVotes-local-server`,
  which shows the log. macOS/Linux: the log is `.next/local-server.log`.
- Stop keeps all data in Docker volumes.
- Windows, after a restart: if start says Windows is holding the Supabase
  ports, open PowerShell as Administrator and run `net stop winnat` then
  `net start winnat`, then start again.

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

Master PDF files (D021) need Supabase Storage, so do not exclude
`storage-api` when starting the local stack. The dev server prints the PDF
files with the Chromium that Playwright installed: set
`PLAYWRIGHT_BROWSERS_PATH` if browsers are installed outside the default
folder, or `CHROMIUM_EXECUTABLE_PATH` to use another Chromium.

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

Google login requires local OAuth credentials outside git:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<google oauth client id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<google oauth client secret>
```

The Google OAuth client must allow the local Supabase callback URL:
`http://127.0.0.1:54321/auth/v1/callback`. LAN IPs such as
`192.168.x.x` are for opening the web app from another device, not for the
Google OAuth callback, because Google rejects private-network IP redirect URIs.

After `npm run supabase:start`, generate local demo URLs from the current LAN IP:

```bash
npm run demo:configure:local
npm run supabase:stop
npm run supabase:start
```

The script updates ignored `.env.local` with the current laptop LAN IP for
device demo access, and updates local `supabase/config.toml` redirect allowlist.
Supabase Auth `external_url` stays on `127.0.0.1` for Google OAuth callback
compatibility.

For laptop Google login, start and finish one OAuth attempt on the same app
host, preferably `http://127.0.0.1:3000`. Do not switch between `localhost`,
`127.0.0.1`, and the LAN IP during one attempt because PKCE state and cookies
are host-specific. After `npm run db:reset:local`, clear stale local app cookies
or use a fresh private window before testing Google login again.

Do not open `http://0.0.0.0:3000` in a browser. It is the server bind address,
not a stable browser host. The app redirects it to `APP_CANONICAL_URL`, which
defaults to `http://127.0.0.1:3000`. Keep this separate from
`NEXT_PUBLIC_APP_URL`: the canonical URL normalizes browser host usage, while
`NEXT_PUBLIC_APP_URL` is the configured app origin used by auth redirects and
LAN demo setup.

If automatic IP detection chooses the wrong network interface:

```bash
DEMO_LAN_IP=192.168.1.79 npm run demo:configure:local
```

Grant a local demo admin:

```bash
npm run admin:grant:local -- you@example.com "Demo Admin"
```

Local demo URLs:

```text
App: printed by npm run demo:configure:local
Supabase Studio: http://localhost:54323
Mailpit: printed by npm run demo:configure:local
```

Machines on the same Wi-Fi can use the `Network` URL printed by `npm run dev`.
For a human walkthrough, use [Demo manual steps](demo-manual-steps.md).

`npm run dev` clears `.next/dev/logs/next-development.log` before starting
Next.js so each demo/debug session starts with a fresh log.

## References
- Supabase local development docs: https://supabase.com/docs/guides/cli
- Supabase schema migration docs: https://supabase.com/docs/guides/cli/local-development
- Supabase CLI reference: https://supabase.com/docs/reference/cli/getting-started
