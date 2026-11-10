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

### D008 - Modular Monolith Organized By Domain
Status: accepted

Keep one Next.js app, one Supabase project, and one deployment. Split code into
modules by business domain, and split a domain into sub-features when a file
grows too large. Do not split into microservices for MVP or V1: they add
hosting cost and make transactional voting writes harder. Policy:
[code-organization.md](code-organization.md).

### D009 - Prepare For Multi-Condo Tenancy
Status: accepted

The system should be able to serve more than one condominium in the future.
Implementation is deferred to the Later phase. Until then:
- Do not add new code that assumes a single condominium, such as global
  singleton settings without a scope.
- Design new tables so a `project_id` (condominium) column can be added later.
- Planned shape: a `projects` table, a `project_id` foreign key on
  condominium-scoped tables, and RLS based on project membership.

### P001 - Framework Choice
Status: accepted

Use Next.js App Router (Next.js 16). The app uses server components, server
actions, and route handlers, deployed as one app (see D008).

### P002 - Email Provider
Status: accepted

Use Google SMTP. Google applies daily send limits, so all email goes through
the queued delivery described in [communication.md](communication.md).

## Accepted, Not Yet Implemented
These decisions were made on 2026-11-08 for V1. Implementation is pending.

### D010 - Voting Core Service
Status: implemented (migration 0020, `features/voting/core/ballot-service.ts`)

Every ballot write goes through one voting core service: online votes,
admin-imported manual ballots, and online/manual conflict resolution. The
service runs in one database transaction (Postgres RPC) and is the single
place for the rules in D011, D012, D017, and the voting window. This is a
module inside the app (D008), not a separate deployment.

### D011 - One Voting Right Per Room
Status: implemented (migration 0020)

- If a meeting has an approved proxy for a room, only that proxy can vote
  for the room in that meeting.
- Otherwise, the first eligible voter who submits locks the room. Other
  eligible voters for the room cannot change that ballot. The voter who
  locked it can edit it until voting closes.
- Co-owner consent is not required.
- `eligible_voters_snapshot` keeps one voter per room. After publishing,
  approving or revoking a proxy updates that row, and is refused once the
  room has voted (`VOTE_ROOM_ALREADY_VOTED`).

### D012 - Proxy Limit
Status: implemented (migration 0020)

One proxy can hold at most three rooms per meeting (Condominium Act
section 47). Enforce it when creating and approving proxy authorizations.

### D013 - Configurable Pass Thresholds
Status: implemented (migration 0022, [resolution-rules.md](resolution-rules.md))

Admin sets the pass rule per question: a basis and a percentage. Bases:
ownership of rooms that voted, or total project ownership. Example: 50% of
voting ownership, or 50% of total ownership. Presets for common legal rules
may be offered. Abstain is reported as its own group and counts as voting
(it is in the "rooms that voted" denominator). Comparison is "more than" or
"at least", because legal rules use both (more than half; at least 3/4).

### D014 - Committee Approval And Vote Closing
Status: implemented (migration 0023, `/committee` page)

- Admin sets a minimum number of committee approvals.
- A result is published when its snapshot reaches that minimum. Each
  approval is a separate, immutable record.
- Voting closes automatically at `ends_at`, or earlier when committee
  approvals to close reach the same minimum.
- Generating a result does not close voting. It is allowed only after
  voting has closed, so a single admin cannot end voting early.
- Store times in UTC; display in Asia/Bangkok.

### D015 - Ballot Secrecy Per Meeting
Status: implemented (migration 0024)

Admin chooses open or secret ballot when creating a meeting. For a secret
ballot, admins see totals only, not which room chose what.

### D016 - System Admin Role And PDPA Settings
Status: implemented (migration 0025, `/consent` and `/system` pages)

- Add a `system_admin` role for technical, service, and maintenance
  settings. Admins who run meetings are not expected to be technical.
- Collect PDPA consent at registration. System admin configures the
  privacy notice text and data retention periods.

### D017 - Question Choices
Status: implemented (migration 0021)

- Multiple-choice questions are supported in V1.
- Every question gets an "Abstain" choice by default. Admin can remove it
  while setting up choices. The choice carries an abstain flag so results
  can count it as its own group.
- Multiple choice questions can set `max_choices`. Abstain cannot be
  combined with other choices. Questions of draft meetings got the default
  Abstain choice when this shipped; published meetings were not changed.

### D018 - Electronic Meeting Compliance In V1
Status: accepted

V1 handles the electronic meeting decree requirements (identity check,
meeting recording, evidence keeping) manually, outside the system. See
[compliance.md](compliance.md).

### D019 - Result Documents And Voting Phases
Status: implemented (migration 0026)

- Two documents come from one approved result snapshot:
  - Official result record (`/record/[snapshotId]`): Thai, A4, for admin and
    committee. It is the copy the juristic person keeps and signs.
  - Owner summary (`/summary`): Thai, shorter, with a link to
    `/verify/[snapshotId]`.
- Every snapshot stores `payload_sha256`. Both documents print the snapshot
  ID and the hash so a copy can be checked against the system.
- Things a lawyer may answer differently are settings, not code:
  signatories and the result notice period (condo setup), notice date,
  meeting round, identity method, recording and log references, and
  incidents (meeting record page).
- A meeting can have an optional advance voting window before meeting day.
  `submit_ballot` accepts votes in either window. Between the two windows
  voting is closed.
- The record shows room counts and ownership only, never per-room answers.
