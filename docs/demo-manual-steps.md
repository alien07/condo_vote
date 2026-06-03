# Demo Manual Steps

Use this checklist when a person manually demos the local condoVotes app.

## 1. Start Local Services

```bash
npm run supabase:start
npm run demo:configure:local
npm run supabase:stop
npm run supabase:start
npm run dev -- --hostname 0.0.0.0 --port 3000
```

If the detected LAN IP is wrong:

```bash
DEMO_LAN_IP=<laptop-lan-ip> npm run demo:configure:local
```

## 2. Open Demo URLs

- Laptop app: `http://127.0.0.1:3000`
- Same-Wi-Fi app: use the `Network` URL printed by `npm run dev`
- Supabase Studio: `http://localhost:54323`
- Mailpit: use the Mailpit URL printed by `npm run demo:configure:local`

## 3. Login

1. Open `/login`.
2. Click `Continue with Google`.
3. Login with the configured local demo admin email.
4. Confirm the app redirects back and `/admin` is accessible.
5. Confirm the top shell shows the logged-in full name, email, default status,
   app roles, and `Logout`.
6. Use the top navigation to switch between `Admin`, `Vote`, and `Summary`.
7. Click `Logout`, then confirm protected pages redirect back to `/login`.

If Google login fails, check `docs/error_code.md` and confirm the Google OAuth
client allows `http://127.0.0.1:54321/auth/v1/callback`.

## 4. Admin Demo Path

1. Open `/admin/setup` and confirm juristic profile, private document registry,
   committee, and business audit sections render.
2. Save `local_drive` or `google_drive` document storage settings.
3. Register one synthetic private document reference with a path/link, document
   set key, version, file size, and SHA-256. Confirm `document.registered`
   appears in the business audit log.
4. Open `/admin/people`.
5. Download each Excel template: rooms, owners, room owners.
6. Upload edited `.xlsx` files and confirm rows appear after upsert.
7. Create or verify owner/resident profiles and app roles.
8. Open `/admin/meetings`.
9. Create a meeting, question, and choices.
10. Publish the meeting and confirm eligible voters are generated.
11. Open `/admin/communications`.
12. Queue a vote invitation for one eligible owner/proxy.
13. Queue group invitations for eligible voters.

## 5. Vote Demo Path

1. Login as an owner or proxy profile with eligibility.
2. Open `/vote`.
3. Confirm the top shell shows the owner/proxy profile and the breadcrumb shows
   `Vote`.
4. Open the meeting assignment.
5. Use `Back` from the ballot detail page to return to `/vote`.
6. Submit a ballot.
7. Edit the ballot while the meeting is still open.
8. Confirm version history shows the new ballot version.

## 6. Result Demo Path

1. Open `/admin/voting`.
2. Import a manual ballot for the same meeting if conflict behavior is being demoed.
3. Resolve any manual/online conflict.
4. Open `/admin/results`.
5. Generate a result snapshot.
6. Approve the result with committee/admin notes.
7. Open `/summary` and confirm approved result and mock PDF preview render.

## 7. Test Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e -- --project=chromium
```
