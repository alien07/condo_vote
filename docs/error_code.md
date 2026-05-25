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
