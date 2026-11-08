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

## Voting Core Service Functions
Migration 0020 adds `security definer` functions that check permissions
themselves: `submit_ballot` (eligible voter, open window, room lock),
`submit_manual_ballot` and `resolve_vote_source_conflict` (admin only).
Proxy triggers enforce the three-room limit and sync the snapshot after
publishing. Database tests: `supabase/tests/voting_core.test.sql`.

## Committee Approval Functions
Migration 0023 adds `approve_result_snapshot`, `approve_close_voting`, and
`committee_overview` (admin or committee only, checked by
`can_approve_as_committee()`). Authenticated users can read
`result_publications`; `result_snapshots` are readable by viewers only when
published. Admin and committee can read `meeting_close_approvals`.
Database tests: `supabase/tests/committee_approvals.test.sql`.

## Ballot Secrecy (D015)
Migration 0024 lets admins read `ballots` (which rooms voted) and
`ballot_answers` only when the meeting is an open ballot. For a secret
ballot, admins get totals through `meeting_online_tally(meeting)` (admin
only, security definer), which sums the online answers that count in the
result. Voters always see their own answers. Before 0024 admins could not
read online ballots at all, so results only counted manual votes.
Database tests: `supabase/tests/secret_ballot.test.sql`.

## System Admin And PDPA (D016)
Migration 0025 adds the `system_admin` role. Admins can grant `admin` and
`committee`, but only a system admin can grant or remove `system_admin`.
`app_settings` and `privacy_settings` can be changed only by a system admin;
admins can still read `app_settings`, and every signed-in user can read
`privacy_settings`. Users read their own `profile_consents`; admins and
system admins read all. `needs_privacy_consent()` and
`accept_privacy_notice(version)` run as security definer.
Database tests: `supabase/tests/privacy.test.sql`.

## Still Needed
- `approval_requests` has no policies yet.
- Provider-specific file access policies after direct upload adapters are selected.
