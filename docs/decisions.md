# Decisions

## Accepted

### D001 - Use Supabase For Backend
Status: accepted

Use Supabase Auth, PostgreSQL, RLS, Storage, and Edge Functions for MVP because the domain is relational and the project needs low-cost backend operations.

### D002 - Store Video As External URL
Status: accepted

Do not upload video files into Supabase for MVP. Store an external video URL to control storage cost and avoid free-tier limits.

### D003 - Google Or Email Auth Before LINE
Status: accepted

Use Google login for MVP. Vote invitation links carry the intended in-app destination, but Supabase policy checks decide whether the user can vote after login. LINE login can be revisited after the voting flow is validated.

### D004 - Results Require Approval Before Publication
Status: accepted

Calculated results stay hidden until committee/admin approval.

### D005 - Use app_roles For System Permissions
Status: accepted

Assign admin and committee permissions through `app_roles`. Do not overload voter status or approval status for system authorization.

### D006 - committee_approvals Is Result Approval Source Of Truth
Status: accepted

Use `committee_approvals` as the source of truth for approved result publication. `result_snapshots` stores calculated payloads only.

### D007 - Free-Tier Constraints Shape MVP Architecture
Status: accepted

Keep the MVP within low-cost/free-tier limits by storing video externally, keeping email provider integration swappable, limiting initial scope to one condominium/project, and avoiding production personal data in development.

## Proposed

### P001 - Framework Choice
Status: proposed

Use Next.js if server-rendered routes, API routes, and Vercel deployment are preferred. Use React SPA if the app should stay simpler and Supabase handles all backend work directly.

### P002 - Email Provider
Status: proposed

Evaluate Resend, Brevo, or Google Workspace SMTP based on free tier, Thai language deliverability, and sender-domain requirements.
