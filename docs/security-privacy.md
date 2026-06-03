# Security And Privacy

## Sensitive Data
The system may store:
- Names
- Emails
- Phone numbers
- Room numbers
- Ownership percentages
- LINE IDs
- Proxy documents
- Ownership verification documents
- Voting history

## Rules
- Do not commit real resident data.
- Do not commit `.env` files, API keys, Supabase service role keys, OAuth secrets, or private documents.
- Use synthetic seed data only.
- Keep document storage private unless a public export is explicitly required.
- Store private document paths or links in the registry. Never store Google OAuth tokens, service-account keys, or signed access tokens in the database.
- Use a stable private locator or short-lived signed URL appropriate to the configured provider.
- Record SHA-256 and file size when registering a document so the exact file can be verified later.
- Mask personal data in logs and screenshots.

## Access Control
- Users can read their own profile and eligible meetings.
- Users can submit or update ballots only for rooms they are eligible to vote for.
- Admins can manage master data, meetings, approvals, and results.
- Committee/admin approval is required before results become public.
- RLS policies must be enabled before production use.
- Baseline auth RLS policies are documented in [rls-policies.md](rls-policies.md).

## Audit Needs
Track:
- Profile approval/rejection
- Proxy approval/rejection
- Meeting publication
- Ballot submission and version changes
- Result snapshot generation
- Committee result approval
- Private document setting changes and document reference registration

`audit_logs` records business actions. Ballot versions preserve vote edits. The
current server actions write the business mutation and audit record separately;
use database transactions or RPCs before claiming legal-grade atomic audit.

## Operational Notes
- Prefer separate Supabase projects for dev and production.
- Rotate exposed keys immediately.
- Never use the Supabase service role key in frontend code.
- Review generated PDF contents before sending email.
