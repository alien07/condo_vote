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
- Keep Storage buckets private unless a public export is explicitly required.
- Use signed URLs for private document access.
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

## Operational Notes
- Prefer separate Supabase projects for dev and production.
- Rotate exposed keys immediately.
- Never use the Supabase service role key in frontend code.
- Review generated PDF contents before sending email.
