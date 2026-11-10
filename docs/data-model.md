# Data Model

This is the initial relational model. Names may change during implementation, but domain boundaries should stay stable.

## User Roles

| Role | Purpose | Vote Permission |
| --- | --- | --- |
| System admin | Manages technical, service, and maintenance settings, including PDPA notice and retention (D016). Role `system_admin`; only a system admin can grant it. | Same as normal user unless separately eligible. |
| Admin | Manages master data, meetings, questions, choices, approvals, and result publication. | Can manage votes but should not vote unless also eligible as owner/proxy. |
| Committee | Reviews calculated results and approves publication. | Same as normal user unless separately eligible. |
| Owner | Verified room owner. | Can vote for owned room. |
| Proxy | Approved representative for a specific meeting and room. | Can vote for assigned room only during the authorized meeting. |
| Resident | Occupant without ownership rights. | Cannot vote unless approved as proxy. |

## ERD Summary

```mermaid
erDiagram
    rooms ||--o{ room_owners : has
    owners ||--o{ room_owners : owns
    profiles ||--o{ app_roles : grants
    profiles ||--o{ approval_requests : requests
    profiles ||--o{ proxy_authorizations : acts_as_proxy
    meetings ||--o{ proxy_authorizations : scopes
    meetings ||--o{ meeting_questions : contains
    meeting_questions ||--o{ meeting_choices : offers
    meetings ||--o{ eligible_voters_snapshot : freezes
    rooms ||--o{ eligible_voters_snapshot : eligible_room
    profiles ||--o{ eligible_voters_snapshot : eligible_voter
    meetings ||--o{ ballots : receives
    rooms ||--o{ ballots : casts
    profiles ||--o{ ballots : submitted_by
    ballots ||--o{ ballot_answers : includes
    ballots ||--o{ ballot_versions : versions
    meetings ||--o{ manual_ballots : imports
    rooms ||--o{ manual_ballots : manual_room
    manual_ballots ||--o{ manual_ballot_answers : includes
    ballots ||--o{ vote_source_resolutions : online_conflict
    manual_ballots ||--o{ vote_source_resolutions : manual_conflict
    meetings ||--o{ result_snapshots : calculates
    result_snapshots ||--o{ committee_approvals : approved_by
    documents }o--|| profiles : uploaded_by
    profiles ||--o{ audit_logs : acts
    email_logs }o--|| profiles : optional_recipient
```

## Core Tables

| Table | Purpose |
| --- | --- |
| [condo_profiles](#condo_profiles) | Juristic person profile used as the issuer identity for formal documents and PDFs. |
| [committee_members](#committee_members) | Real committee roster and positions for document approval/signature context. |
| [rooms](#rooms) | Master data for condominium units. Used as the base voting right because one room equals one vote. |
| [owners](#owners) | Master data for legal owners from juristic office records or verified admin input. |
| [room_owners](#room_owners) | Links owners to rooms with effective dates, current/scheduled/ended/cancelled state, and ownership history. |
| [profiles](#profiles) | Application user profile linked to Supabase Auth identity. |
| [app_roles](#app_roles) | Assigns system roles such as admin and committee to profiles. |
| [approval_requests](#approval_requests) | Tracks user requests to become an approved owner, resident, or proxy voter. |
| [proxy_authorizations](#proxy_authorizations) | Meeting-specific proxy permissions allowing a non-owner to vote for a room. |
| [meetings](#meetings) | Voting event or condominium meeting configuration. |
| [meeting_incidents](#meeting_incidents) | Problems during voting and what was done, for the official record. |
| [meeting_questions](#meeting_questions) | Questions shown inside a meeting vote/survey. |
| [meeting_choices](#meeting_choices) | Choices available for each meeting question. |
| [eligible_voters_snapshot](#eligible_voters_snapshot) | Frozen voter eligibility list for a meeting. Used to make result calculation auditable. |
| [ballots](#ballots) | Current ballot record per meeting and room. |
| [ballot_answers](#ballot_answers) | Current effective answers for a ballot. |
| [ballot_versions](#ballot_versions) | Historical ballot payloads whenever a voter edits before close. |
| [manual_ballots](#manual_ballots) | Admin-imported paper/offline ballot record per meeting and room. |
| [manual_ballot_answers](#manual_ballot_answers) | Current effective answers for an imported manual ballot. |
| [vote_source_resolutions](#vote_source_resolutions) | Admin decision record when the same room has both online and manual votes. |
| [result_snapshots](#result_snapshots) | Calculated result payloads for a meeting before/after approval. |
| [committee_approvals](#committee_approvals) | One committee member's approval of a result snapshot. |
| [result_publications](#result_publications) | Published result per meeting, written when approvals reach the minimum. |
| [meeting_close_approvals](#meeting_close_approvals) | Committee approvals to close voting before `ends_at`. |
| [documents](#documents) | Private file references for owner/proxy approval and generated PDFs. |
| [app_settings](#app_settings) | App-level operational settings such as the selected private document storage provider. |
| [privacy_settings](#privacy_settings) | One row: PDPA privacy notice, its version, and retention periods. |
| [profile_consents](#profile_consents) | Which privacy notice version each profile accepted. |
| [audit_logs](#audit_logs) | Append-only business action records for traceability and troubleshooting. |
| [email_logs](#email_logs) | Delivery log for invitations, reminders, and result notifications. |

SQL draft: [schema-draft.sql](schema-draft.sql). This is not final and must be reviewed before migration.

## Table Notes

This section explains table responsibilities at the domain level. Column types and migration details live in [schema-draft.sql](schema-draft.sql).

### rooms
Purpose: Stores one condominium unit.
Key fields: room number, floor/building, area size, ownership percentage, active flag.
Notes: Source of truth for one-room-one-vote and ownership-weighted result calculation.

### condo_profiles
Purpose: Stores the juristic-person/project identity printed on formal documents.
Key fields: juristic name, project name, registration number, tax ID, address, contact channels, manager name, document footer.
Notes: Keep this separate from app config because it is legal/business data, not application branding.
Record settings (D019): `record_signatories` (chairperson, manager, minutes_taker, committee_member; 1 to 4) and `result_notice_days` (1 to 90, optional).

### committee_members
Purpose: Stores actual committee member names and positions.
Key fields: profile link, full name, position title, term dates, display order, active flag.
Notes: This is document and governance data. `app_roles` remains system authorization only.

### owners
Purpose: Stores verified legal owner master data.
Key fields: full name, email, phone, LINE ID, active flag.
Notes: Can come from juristic office records or admin import. Keep separate from login profile.

### room_owners
Purpose: Links owners to rooms.
Key fields: room, owner, ownership role, start/end dates, status, cancelled timestamp, cancelled by.
Notes: Date fields drive Active/Scheduled/Ended display state; `status=cancelled` is stored as business state for scheduled links that should never become active. `cancelled_at` and `cancelled_by` are kept on the row for direct reporting, while `audit_logs` keeps the full action history.

### profiles
Purpose: Stores app-level user data linked to Supabase Auth.
Key fields: auth user ID, full name, email, phone, LINE ID, default status, approval status.
Notes: A profile is not automatically eligible to vote. Eligibility must come from approval and meeting snapshot.

### app_roles
Purpose: Assigns system-level permissions to profiles.
Key fields: profile, role, granted by, granted timestamp.
Notes: Use this for admin and committee authorization. Do not overload voter status fields for system permissions.

### approval_requests
Purpose: Tracks admin review for user eligibility requests.
Key fields: profile, requested status, room, review status, reviewer, review timestamp.
Notes: Used for owner/resident/proxy onboarding before voting rights are granted.

### proxy_authorizations
Purpose: Grants a proxy right for a specific meeting and room.
Key fields: meeting, room, owner, proxy profile, status, validity window, reviewer.
Notes: Proxy voting is scoped to a meeting, not global.

### meetings
Purpose: Stores each voting event or condominium meeting.
Key fields: title, meeting number, meeting type, fiscal year, location/platform, chairperson, quorum rule, start/end time, status.
Notes: Voting is allowed only inside the configured window after publication. Meeting metadata is copied into result snapshots for PDF/audit use.
Record fields (D019): optional advance voting window (`advance_starts_at`, `advance_ends_at`, must end before `starts_at`), `notice_sent_at`, `meeting_round` (first or reconvened), `identity_method`, `recording_reference`, `traffic_log_reference`.

### meeting_incidents
Purpose: Problems during voting (outages, delays) and what was done, for the official record (D019).
Key fields: meeting, started/ended time, description, action taken, created by.
Notes: Admin writes; admin and committee read. Copied into the result snapshot.

### meeting_questions
Purpose: Stores questions configured by admin for a meeting.
Key fields: meeting, agenda number/title, question text, question type, resolution type, required threshold, land-office registration flag, legal note.
Notes: Resolution metadata lets the PDF explain why an agenda passed or failed under the configured rule.

### meeting_choices
Purpose: Stores choices under each question.
Key fields: question, choice text, display order.
Notes: Abstain can be modeled as a normal choice if the requirement confirms it.

### eligible_voters_snapshot
Purpose: Freezes eligible voters for one meeting.
Key fields: meeting, room, profile, voter type, ownership percentage, source.
Notes: Result calculation should use this snapshot instead of live master data so history remains auditable.

### ballots
Purpose: Stores the current ballot record for a meeting and room.
Key fields: meeting, room, voter profile, status, submitted timestamp, version number.
Notes: There should be one effective ballot per meeting and room.

### ballot_answers
Purpose: Stores current effective selected choices for a ballot.
Key fields: ballot, question, choice.
Notes: These are updated when a voter edits before the voting window closes.

### ballot_versions
Purpose: Stores immutable ballot history.
Key fields: ballot, version number, payload snapshot, created timestamp.
Notes: Every submit/edit should create a version for audit.

### manual_ballots
Purpose: Stores imported manual/offline ballot records per meeting and room.
Key fields: meeting, room, importer, voter profile, voter identity text, identity status, source label, audit note, status, imported timestamp.
Notes: Mirrors the online `ballots` table closely enough that result calculation can choose either source per room. `identity_status=linked` means the manual voter is tied to a profile, `pending` means admin captured a free-text identity but it is not result-ready, and `legacy` preserves older imported manual ballots created before identity columns existed. Pending manual vote identity records block result generation and committee approval.

### manual_ballot_answers
Purpose: Stores current effective selected choices for an imported manual ballot.
Key fields: manual ballot, question, choice.
Notes: Mirrors `ballot_answers`. One answer is stored per manual ballot and question.

### vote_source_resolutions
Purpose: Stores admin conflict decisions when a room has both online and manual vote sources.
Key fields: meeting, room, online ballot ID, manual ballot ID, chosen source, chosen ballot ID, conflict remark, resolver, resolved timestamp.
Notes: Result generation should fail when an online/manual conflict exists without a matching resolution for the current ballot IDs. Result snapshots must include the source audit summary.

### result_snapshots
Purpose: Stores generated result calculations.
Key fields: meeting, generated timestamp, generator, result payload.
Notes: `payload_sha256` is set by trigger from the payload text and printed on both result documents (D019). Payload should include count, percentage against total project ownership, percentage against submitted-vote ownership, effective vote source, and conflict resolution audit. Once a snapshot is referenced by `committee_approvals`, it is immutable. New snapshots for the same meeting are blocked after approval.

### committee_approvals
Purpose: Stores approval that allows result publication.
Key fields: meeting, result snapshot, approver, approved timestamp, notes.
Notes: One row per approver per snapshot (unique snapshot + approver). Approval records are immutable. Approvals go through `approve_result_snapshot` (0023), which publishes when approvals reach `meetings.required_approvals` (D014).

### result_publications
Purpose: Marks a meeting result as published.
Key fields: meeting (unique), result snapshot (unique), approvals count, published timestamp.
Notes: Source of truth for result visibility. Written only by `approve_result_snapshot`. Viewers can read a snapshot only when it has a publication row.

### meeting_close_approvals
Purpose: Records committee approvals to close voting early.
Key fields: meeting, approver, approved timestamp.
Notes: `approve_close_voting` sets the meeting to `closed` and `closed_at` when approvals reach `meetings.required_approvals`. Otherwise voting closes at `ends_at`.

### documents
Purpose: Stores provider-agnostic private document references.
Key fields: owner type, owner ID, document type, provider, storage path or private link, document set key, version, original filename, MIME type, file size, SHA-256 checksum, visibility, uploader.
Notes: Used for owner/proxy approval documents and generated PDFs. Default visibility is private. The `document_set_key` groups revisions of one logical document; SHA-256 and file size verify the exact file. Provider credentials must not be stored in this table.

### app_settings
Purpose: Stores technical settings controlled by the system admin (D016). Admins can read them.
Key fields: document storage provider and root path or private folder link.
Notes: V1 supports `local_drive` and `google_drive` as registry providers. Store only the root locator. Keep Google credentials outside the database.

### privacy_settings
Purpose: PDPA privacy notice and retention periods (D016).
Key fields: consent required flag, notice text, notice version, vote record retention (months), inactive profile retention (months), updated by/at.
Notes: One row. Only `system_admin` can update. Changing the notice text increases the version, so every user accepts again. Retention periods are recorded settings; deletion runs as a manual maintenance task in V1. Local and CI seed set `consent_required = false`.

### profile_consents
Purpose: Records PDPA consent.
Key fields: profile, notice version, accepted timestamp.
Notes: Unique per profile and version. Written only by `accept_privacy_notice()`, which also writes a `privacy.accepted` audit entry.

### audit_logs
Purpose: Stores business audit entries created by authenticated actions.
Key fields: actor profile, action, entity type, entity ID, JSON details, created timestamp.
Notes: Admin can inspect the latest audit entries. Ballot versions remain the detailed immutable vote history. For legal-grade atomic audit guarantees, move each business mutation and audit insert into a database transaction or RPC.

### email_logs
Purpose: Stores email send attempts for audit and troubleshooting.
Key fields: recipient email, template key, delivery status, provider message ID, sent timestamp, error message.
Notes: Used for invitations, reminders, and result notifications.

## Important Constraints
- One effective ballot per meeting and room.
- Ballot edits create new versions.
- Result calculations use the latest valid ballot per room.
- Manual votes can be combined with online votes, but one room can have only one effective source after conflict resolution.
- `result_publications` is the source of truth for result visibility; `committee_approvals` holds each approver's record.
- Approved result snapshots and committee approval records are immutable.
- Supporting documents are private by default.

## Planned Schema Changes (V1)
Decided on 2026-11-08; see [decisions.md](decisions.md). Not migrated yet.

| Change | Decision |
| --- | --- |
| ✅ Ballot writes through one transactional RPC for online, manual, and conflict resolution (0020) | D010 |
| ✅ Room voting-right lock: approved proxy first, otherwise first voter (0020) | D011 |
| ✅ Proxy limit of three rooms per proxy per meeting (0020) | D012 |
| ✅ Per-question pass rule: `pass_basis`, `pass_operator`, `pass_percent`; `required_threshold` is now a preset or `custom` (0022) | D013 |
| ✅ `meetings.required_approvals`, `closed_at`; several approvals per snapshot; `result_publications`; `meeting_close_approvals` (0023) | D014 |
| ✅ `meetings.ballot_secrecy` (`open`/`secret`, fixed after publishing); admin reads online answers only for open ballots; `meeting_online_tally()` (0024) | D015 |
| ✅ `system_admin` role; `privacy_settings`; `profile_consents`; storage settings editable by system admin only (0025) | D016 |
| ✅ Multiple answers per question in `ballot_answers` and `manual_ballot_answers`; `is_abstain` flag on choices; `max_choices` on questions (0020, 0021) | D017 |

## Open Questions
- None open for V1. Co-owner consent is not required (D011); multiple choice
  and the Abstain choice are decided in D017.
