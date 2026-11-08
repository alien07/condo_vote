# RLS Policies

## Baseline Auth Policies
Implemented in `supabase/migrations/0002_auth_rls_policies.sql`.

### Helper Functions
- `public.current_profile_id()` resolves the current Supabase Auth user to `profiles.id`.
- `public.has_app_role(required_role text)` checks `app_roles` for the current profile.

Both functions are `security definer` so policies can check profile and role data without recursive RLS failures. Default public execution is revoked; only authenticated users can execute them.

### profiles
- Authenticated users can read their own profile.
- Admins can read all profiles.
- Authenticated users can insert only their own profile during auth callback bootstrap.
- Admins can update profiles.
- Self-update is intentionally not enabled yet because `profiles` contains sensitive status fields such as `default_status` and `approval_status`.

### app_roles
- Authenticated users can read only their own roles.
- Admins can read and manage roles.

### app_settings
- Admins can read, insert, and update operational settings.

### audit_logs
- Admins can read business audit entries.
- Authenticated users can insert audit entries only for their own profile.

### documents
- Admins can read, insert, and update private document references.
- Document storage credentials are intentionally outside PostgreSQL.

## Implemented Coverage
| Migration | Tables |
| --- | --- |
| 0003 | rooms, owners, room_owners |
| 0004 | meetings |
| 0005 | proxy_authorizations |
| 0006 | meeting_questions, meeting_choices |
| 0007 | eligible_voters_snapshot |
| 0008 | result_snapshots, committee_approvals (admin) |
| 0009 | email_logs |
| 0010 | condo_profiles, committee_members |
| 0011, 0012 | manual_ballots, manual_ballot_answers, vote_source_resolutions |
| 0014 | voter policies: ballots, ballot_answers, ballot_versions, eligible meetings and rooms |
| 0015 | approved results and summary access for authenticated users |
| 0016 | app_settings, audit_logs, documents |

## Still Needed
- Committee policies: today only admins can insert `committee_approvals`. Committee members need to approve results and close voting (D014).
- `approval_requests` has no policies yet.
- `system_admin` role policies for technical settings (D016).
- Secret ballot: admins see totals only (D015).
- Room lock and proxy limit rules, enforced in the voting core service RPC (D010, D011, D012).
- Provider-specific file access policies after direct upload adapters are selected.
