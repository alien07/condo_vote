# Error Codes

This document lists application-level error codes shown in the UI or written to
server logs. Provider-specific raw errors, secrets, and tokens must not be
displayed to users or committed to docs.

## Auth And Login

| Code | Meaning | Common scenario | Where to check |
| --- | --- | --- | --- |
| `AUTH_MISSING_ORIGIN` | The app could not determine a safe redirect origin. | Request has no `Origin` header and `NEXT_PUBLIC_APP_URL` is not configured. | `.env.local`, request host, Next server logs. |
| `AUTH_GOOGLE_PROVIDER` | Supabase rejected the Google OAuth start request. | Google provider is disabled, OAuth env is missing, or local Supabase was not restarted after config changes. | `supabase/config.toml`, `supabase/.env`, `docker logs supabase_auth_condovotes`. |
| `AUTH_GOOGLE_REDIRECT_MISSING` | Supabase did not return a provider redirect URL. | Unexpected Supabase Auth response after calling Google sign-in. | Next server logs and Supabase Auth logs. |
| `AUTH_CALLBACK_MISSING_TOKEN` | Auth callback was opened without `code` or OTP token parameters. | User opens `/auth/callback` manually, stale browser redirect, or a crawler hits the callback URL. | Browser URL and Next server logs. |
| `AUTH_CALLBACK_EXCHANGE_FAILED` | Callback received a token but session exchange failed. | OAuth host mismatch causing PKCE `bad_code_verifier`, stale cookies, expired code, wrong Supabase callback URL, or reused callback URL. | `docker logs supabase_auth_condovotes`; look for `bad_code_verifier`, `OAuth state parameter missing`, or token errors. |
| `AUTH_CALLBACK_USER_MISSING` | Token exchange did not produce an authenticated user. | Supabase session exists but user lookup failed or cookies were not persisted. | Next server logs and browser cookie state. |
| `AUTH_CALLBACK_PROFILE_FAILED` | The app could not create or load the local `profiles` row. | Profile insert violates constraints, email is missing, or RLS/db error occurs after OAuth login. | Next server logs, database logs, `profiles` table constraints. |

## Routing Outcomes

| Code | Meaning | Common scenario | User result |
| --- | --- | --- | --- |
| `AUTH_ROUTE_TO_SUMMARY` | The user is authenticated but cannot go to the requested vote page. | Meeting is closed, user is resident, user is not in `eligible_voters_snapshot`, or room/meeting target is invalid. | Redirect to `/summary` or `/summary/{meetingId}`. |

## Voting Core Service

Raised by the voting core service functions in
`supabase/migrations/0020_voting_core_service.sql` as `VOTE_<CODE>: message`
and mapped to `VoteError` in `features/voting/core/ballot-service.ts`.

| Code | Meaning | Common scenario |
| --- | --- | --- |
| `VOTE_NOT_SIGNED_IN` | No signed-in profile. | Session expired before submit. |
| `VOTE_NOT_ELIGIBLE` | The profile is not the room's voter in `eligible_voters_snapshot`. | Resident or a voter for another room opens a ballot URL. |
| `VOTE_CLOSED` | The meeting is not published or is outside its voting window. | Submit after `ends_at` or before `starts_at`. |
| `VOTE_ROOM_LOCKED` | Another voter already submitted this room's ballot (D011). | The room voter changed after the first vote. |
| `VOTE_INVALID_ANSWERS` | Answers fail validation. | Missing required question, two choices on single choice, or a choice from another question. |
| `VOTE_FORBIDDEN` | The action needs the admin role. | Non-admin calls a manual ballot or conflict function. |
| `VOTE_INVALID_CONFLICT` | Conflict input does not match the meeting and room. | Stale conflict form after data changed. |
| `VOTE_PROXY_LIMIT` | The proxy already holds three rooms in this meeting (D012). | Admin adds a fourth room for the same proxy. |
| `VOTE_ROOM_ALREADY_VOTED` | The room already voted, so its proxy cannot change (D011). | Approving or revoking a proxy after the room voted. |
| `VOTE_SECRECY_LOCKED` | Ballot secrecy cannot change after publishing (D015). | Editing a published meeting from open to secret. |

## Privacy Consent

Raised by `accept_privacy_notice` in
`supabase/migrations/0025_system_admin_privacy.sql`.

| Code | Meaning | Common scenario |
| --- | --- | --- |
| `PRIVACY_NOT_SIGNED_IN` | No signed-in profile. | Session expired on the consent page. |
| `PRIVACY_NOTICE_CHANGED` | The notice version changed while the user was reading. | System admin saved a new notice; the page reloads with the new text. |

## Committee Approvals

Raised by `approve_result_snapshot` and `approve_close_voting` in
`supabase/migrations/0023_committee_approvals.sql` as `RESULT_<CODE>: message`
and mapped to `ResultError` in `features/results/committee-service.ts`.

| Code | Meaning | Common scenario |
| --- | --- | --- |
| `RESULT_FORBIDDEN` | The caller is not an admin or committee member. | Owner opens the committee page directly. |
| `RESULT_NOT_FOUND` | The snapshot or meeting does not exist. | Stale form after a reset. |
| `RESULT_ALREADY_PUBLISHED` | The meeting result is already published. | A third approver submits after the minimum was reached. |
| `RESULT_OTHER_SNAPSHOT` | Another snapshot of the meeting already has approvals. | Approving an older snapshot. |
| `RESULT_PENDING_MANUAL_IDENTITY` | Manual ballots still need voter identity. | Approving before the manual import is complete. |
| `RESULT_ALREADY_APPROVED` | This person already approved this snapshot or closing. | Double submit. |
| `RESULT_VOTING_NOT_OPEN` | Voting is not open, so it cannot be closed early. | Approving close on a draft or closed meeting. |

## Demo Debug Notes

- For local Google OAuth on laptop, use `http://localhost:3000/login` or
  `http://127.0.0.1:3000/login`.
- Do not mix `localhost`, `127.0.0.1`, `0.0.0.0`, and LAN IP in one OAuth
  attempt. PKCE cookies are host-specific and may cause
  `AUTH_CALLBACK_EXCHANGE_FAILED`.
- Google OAuth does not accept LAN IPs such as `192.168.x.x` as authorized
  redirect URIs. Use `127.0.0.1` for local laptop tests or a public HTTPS tunnel
  for mobile OAuth tests.
- If OAuth config changes, restart local Supabase with the Google env loaded.
