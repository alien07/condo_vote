# Architecture

## Preferred Stack
- Frontend: Next.js or React.
- Hosting: Vercel or Netlify for MVP.
- Backend: Supabase.
- Database: Supabase PostgreSQL.
- Auth: Supabase Auth with Google login.
- Authorization: Supabase Row Level Security.
- Files: provider-agnostic private document registry with local-drive or Google Drive references for V1.
- Email: Resend, Brevo, or existing Google Workspace SMTP depending on cost and deliverability.
- Video: external URL such as YouTube unlisted, Google Drive, or Vimeo.

## High-Level Flow
1. Admin imports or creates room and owner master data.
2. User registers or signs in with Google.
3. Admin approves owner or proxy eligibility.
4. Admin creates meeting, questions, choices, and voting window.
5. Admin publishes meeting and sends invitation links.
6. Eligible voter submits or edits ballot while voting is open.
7. System stores ballot versions and uses the latest version for results.
8. System calculates result snapshots.
9. Committee/admin approves result.
10. Approved result can be viewed or exported as PDF.

## Vote Flow
This is more specific than the high-level architecture flow. It describes the business path for one voting event.
Invitation, resend, login redirect, and summary routing details are defined in
[Email invite flow](email_invite_flow.md).

1. Admin prepares room and owner master data.
2. Admin creates meeting, voting window, optional video URL, and optional transcript.
3. Admin creates questions and choices.
4. Admin reviews pending owner/proxy approval requests.
5. Admin publishes the meeting.
6. System creates or refreshes `eligible_voters_snapshot` for the meeting.
7. System sends invitation links to eligible voters.
8. Voter logs in with Google.
9. System checks voter eligibility against the meeting snapshot.
10. Voter submits ballot for one eligible room.
11. If voter edits before `ends_at`, system stores a new ballot version and updates current answers.
12. After `ends_at`, ballot editing is blocked.
13. Admin/system generates `result_snapshots`.
14. Result includes per-choice counts and ownership-weighted percentages using two denominators:
    - Total project ownership.
    - Submitted-vote ownership.
15. Committee/admin approves the result snapshot.
16. Approved result can be viewed, exported to PDF, or sent by email.

## Supabase Responsibilities
- Auth: login identity.
- Profiles: application-level user profile and approval status.
- Postgres: all relational voting data.
- RLS: enforce per-user and per-role access rules.
- Documents: PostgreSQL registry stores private provider, link or path, document set key, version, SHA-256, and file size. Credentials remain outside the database.
- Edge Functions: email delivery, PDF generation, scheduled closing/snapshot work.

## Free-Tier Rationale
- Use Supabase because it gives PostgreSQL, Auth, Storage, RLS, and Edge Functions with a usable free tier for MVP validation.
- Keep video as an external URL because uploaded video can quickly exceed free storage and file-size limits.
- Keep email provider swappable because free or low-cost providers often have daily send limits.
- Start with one condominium/project scope to avoid multi-tenant complexity and cost.
- Use synthetic seed data and separate dev/production Supabase projects to avoid sensitive data leakage while iterating.

## MVP Constraints
- Keep video as URL only.
- Keep all documents private. V1 registers references only; direct upload adapters can be added after provider credentials and sharing policy are approved.
- Avoid custom OAuth until Google auth and policy-based vote links are validated.
- Use synthetic data in seed scripts and demos.

## Deployment Environments
- Local: development with Supabase local or a Supabase development project.
- Preview: branch deploy with non-production Supabase project.
- Production: separate Supabase project and separately secured document storage.

## Open Questions
- Next.js App Router vs React SPA.
- Supabase local-first development or hosted dev project first.
- Exact email provider.
