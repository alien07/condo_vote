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

## Result Documents (D019)
Migration 0026 adds `meeting_incidents`: admin inserts, updates and deletes;
admin and committee select (`can_approve_as_committee()`). Committee members
can also read `committee_approvals`, so the official record can list them.
`submit_ballot` accepts ballots in the advance window or the meeting-day
window. Database tests: `supabase/tests/result_documents.test.sql`.

## Owner Language (D020)
Migration 0027 adds `set_preferred_language(language)`, a security definer
function that changes only the caller's own profile. Admins change any
profile's language through the existing admin update policy.
Database tests: `supabase/tests/owner_language.test.sql`.

## Committee Workflow
Migration 0030 adds close-early requests (`meeting_close_requests`,
`meeting_close_request_answers`) and `result_correction_requests`. Admin and
committee read them; writes go only through security definer functions:
`propose_close_voting`, `answer_close_request` (active committee members),
`cancel_close_request` (the proposer), `request_result_correction`,
`raise_correction_level` and `answer_correction_request` (admin, not the
requester). `approve_close_voting` is no longer granted to signed-in users.
`committee_overview()` returns approvers, objections and correction requests.
Database tests: `supabase/tests/committee_workflow.test.sql`.

## Roles And Ownership (D022)
Migration 0031 adds the `staff` and `auditor` roles. `is_office_staff()`
(admin or staff) replaces the admin check on every policy of `rooms`,
`owners`, `room_owners`, `manual_ballots` and `manual_ballot_answers`, and on
the select policies of the tables those forms read; `submit_manual_ballot`
accepts staff. Auditors get select policies on the audit log, meetings,
profiles, committee requests, correction requests and official result
files. `approve_result_snapshot` refuses the generator of a snapshot and
whoever answered its correction as fixed. `profile_access_active()` limits
external proxy holders to the time they hold an open proxy.
`grant_co_owner_vote` and `cancel_co_owner_vote` let the owner of record
hand one room to a resident co-owner for one meeting.
Database tests: `supabase/tests/roles_ownership.test.sql`.

## Member Access
Migration 0029 limits published results to approved members:
`is_approved_member()` is true for an approved profile or any staff role
(admin, committee, system admin). `result_snapshots`, `result_publications`,
`committee_approvals`, and summary files in `result_documents` and the
`result-documents` bucket require it, so a pending or rejected account (anyone
with a Google account can become one) reads no results.
`verify_result_reference(snapshot)` returns only the meeting title, hash, and
publication of a published result, so the verify page works for every
signed-in account. `my_member_access()` returns what the app shows: results,
the Vote menu (approved owner, proxy, or ballot right), and own rooms a proxy
holds in an open meeting.
Database tests: `supabase/tests/member_access.test.sql`.

## Master PDF Files (D021)
Migration 0028: `result_documents` rows and files in the `result-documents`
bucket are added only for published results, by admin or committee. Admin
and committee read every file; other signed-in users read summary files of
published results. A file may be overwritten only while it has no
`result_documents` row (a failed earlier try). Database tests:
`supabase/tests/result_pdf_files.test.sql`.

## Still Needed
- `approval_requests` has no policies yet.
- Provider-specific file access policies after direct upload adapters are selected.
