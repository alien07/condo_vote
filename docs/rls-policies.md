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

## Still Needed
- Admin policies for questions, choices, approvals, and result snapshots.
- Owner/proxy policies for eligible meetings and ballots.
- Committee policies for result approval.
- Provider-specific file access policies after direct upload adapters are selected.
