# Operations

## Before First Production Deploy
- [ ] Use a paid Supabase plan (Pro) for production. The free tier can pause
  inactive projects and has no point-in-time recovery.
- [ ] Separate Supabase projects for development and production.
- [ ] Production secrets only in the hosting provider, never in git.
- [ ] Google SMTP account and its daily send limit confirmed (P002).
- [ ] Backup plan: export ballots, ballot versions, and result snapshots
  before and after every meeting, and store them outside Supabase.
- [ ] Uptime check on the production URL during voting windows.
- [ ] No deploy during an open voting window
  ([development-workflow.md](development-workflow.md#voting-system-rules)).

## Deploy A Closed Demo (Vercel + Supabase)
For a small invited group. Production later uses the checklist above.

### 1. Supabase project
1. Create a new Supabase project for the demo, region Southeast Asia
   (Singapore). Do not reuse the dev project. The free plan is enough for a
   demo, but it pauses after 7 days without use.
2. From the repo on `dev`, apply the migrations (seed is not applied, so the
   PDPA consent screen stays on):
   ```
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. Authentication > URL Configuration:
   - Site URL: `https://<app-domain>`
   - Redirect URLs: `https://<app-domain>/auth/callback`

### 2. Google sign-in
1. Google Cloud Console > OAuth consent screen: type External, publishing
   status **Testing**. Add every demo user's Google email as a test user
   (up to 100). Only these people can sign in, which keeps the demo closed.
2. Credentials > Create OAuth client ID > Web application:
   - Authorized JavaScript origin: `https://<app-domain>`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase > Authentication > Providers > Google: enable it and paste the
   client ID and secret.

### 3. Vercel
1. Create a `main` branch from `dev` and set it as the Vercel production
   branch, so later work on `dev` does not redeploy during a voting window.
2. Import the GitHub repo. Framework preset Next.js; build command
   `npm run build`.
3. Settings > Functions > Region: Singapore (`sin1`), next to the database.
4. Environment variables (Production):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
   | `NEXT_PUBLIC_APP_URL` | `https://<app-domain>` |
   | `APP_CANONICAL_URL` | `https://<app-domain>` |
   | `ENABLE_LOCAL_AUTH_BYPASS` | `0` |

   Do not add the service role key; the deployed app does not need it.
   Vercel servers run in UTC; the app reads and shows every time as
   Asia/Bangkok on its own (`lib/datetime.ts`).

### 4. First admin
1. Sign in once with Google on the demo URL and accept the privacy notice.
2. In the Supabase SQL editor, approve that profile and give it the admin
   and system admin roles:
   ```sql
   update public.profiles set approval_status = 'approved'
   where email = '<your-email>';

   insert into public.app_roles (profile_id, role)
   select id, role
   from public.profiles, unnest(array['admin', 'system_admin']) as role
   where email = '<your-email>'
   on conflict (profile_id, role) do nothing;
   ```
3. On the System page, review the privacy notice text with the juristic
   person before inviting anyone. Saving a new text starts a new version.

### 5. Demo data and smoke check
1. Admin > People > Import: load rooms, owners, and room links from the Excel
   templates. Use synthetic data unless the group agreed to real data.
2. Create a short test meeting (start now, end in one hour) with one question,
   publish it, vote from a second account, close voting from the Committee
   page, generate and approve the result, and check Summary.
3. Check the times shown on the vote page match the times entered in the
   meeting form.

### Known limits of the demo
- Emails are queued in `email_logs` but not sent; share the demo URL
  directly.
- Voter screens are in English; Thai is planned (roadmap).
- Users need a Google account listed as a test user.

## Runbook: System Down During Voting
Use the existing manual vote import as the fallback channel.

1. **Decide.** If the system is down for more than 15 minutes during the
   voting window, the meeting chair and admin switch to paper or
   phone-collected ballots.
2. **Announce.** Tell voters how to submit, for example a paper ballot at the
   juristic office or a signed form by email, and the deadline.
3. **Collect.** Keep every paper ballot or signed form as evidence.
4. **Import.** When the system is back, admin enters each ballot from
   Admin > Voting > Import manual vote, with an audit note naming the
   fallback channel.
5. **Resolve conflicts.** Rooms that also voted online appear in
   Admin > Voting > Manual/Online Conflicts. Choose one source per room
   with a remark.
6. **Record.** Write the outage times, decision, and channel in the meeting
   minutes and register the evidence in Admin > Documents.

Extending the voting window instead of switching to manual ballots needs
committee approval and must be audited.
