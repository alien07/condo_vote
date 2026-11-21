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

- Added 2026-11-19 (migration 0043): section 47 also bars committee members,
  the manager, their spouses, and staff of the juristic person, its
  contractors or a managing company. The database refuses committee members
  (active roster or committee role) and admin/staff accounts
  (`VOTE_PROXY_NOT_ALLOWED`). Spouses and contractor staff are not in the
  system, so the admin ticks a section 47 confirmation on the proxy form
  (kept in the audit log). A proxy holder may be from outside the condo.

### D013 - Configurable Pass Thresholds
Status: implemented (migration 0022, [resolution-rules.md](resolution-rules.md))

Admin sets the pass rule per question: a basis and a percentage. Bases:
ownership of rooms that voted, or total project ownership. Example: 50% of
voting ownership, or 50% of total ownership. Presets for common legal rules
may be offered. Abstain is reported as its own group and counts as voting
(it is in the "rooms that voted" denominator). Comparison is "more than" or
"at least", because legal rules use both (more than half; at least 3/4).

### D014 - Committee Approval And Vote Closing
Status: implemented (migrations 0023, 0030, 0034, 0035 and 0036, `/committee` page);
the number needed and the tie rule changed in D027 (migration 0046)

- Admin sets a minimum number of committee approvals. Since D027 that
  setting can only raise the majority of all active members
  (`max(setting, floor(N/2)+1)`).
- A result is published when its snapshot reaches that minimum. Each
  approval is a separate, immutable record. Since D027 a member can also
  object with a reason, and a result can end "not passed".
- Voting closes automatically at `ends_at`, or earlier through a
  close-early request (migration 0030, demo review 2026-11-13): a committee
  member or admin proposes it with a reason and a time (as soon as approved,
  or a set time before `ends_at`). Every active committee member is emailed.
  Members approve or object (an objection needs a reason). The same minimum
  closes voting; the proposer's proposal counts as their approval when they
  are a member. Since D027 the request fails when objections reach the
  number needed, or when every member answered without reaching it; a tie
  waits for the chair's casting vote; answers cannot change. (Before D027 it
  failed once the members who had not answered were too few to reach the
  minimum, and a member could change an answer.) One open request per meeting; the proposer
  can cancel; it lapses at `ends_at`. Approving to close without a request
  is no longer possible.
- Generating a result does not close voting. It is allowed only after
  voting has closed, so a single admin cannot end voting early.
- Correction requests (migration 0030): a committee member asks the admin to
  correct a result, by category, with a level. Levels: low (wording only),
  medium (room data, voting rights, paper ballots, and "other"), high (pass
  rule or quorum; needs a legal or by-law reference). The admin may raise a
  level, never lower it, and answers every request; the requester cannot
  answer their own. While a request is open, the admin may generate the
  result again; approvals start from 0 on the new snapshot and members who
  approved the old one are emailed. A high-level request needs every active
  committee member to approve, and the official record shows it prominently.
  An agenda item that fails the vote is still a correct result; approval
  means the count is correct.
- Committee page review (migration 0034, user decisions 2026-11-14):
  - The proposer of a close-early request cannot object to it; they cancel
    it instead. A request that failed or was cancelled stays visible on the
    meeting as "last request".
  - One open correction request per result at a time, whoever asked; a new
    one can be sent once the admin has answered.
  - A member who approved a result cannot request a correction on it, and
    an approval cannot be taken back. A member who finds a mistake after
    approving tells the admin or a member who has not approved (outside the
    system).
  - While a correction request is open, members can still approve, but the
    result is not published. When the admin answers "No change needed" and
    the approvals are complete, the result is published then.
  - Voting closes only on the meeting day (0036, option b): a request can be
    sent during advance voting, but its close time must fall within
    meeting-day voting, and "as soon as approved" is allowed only once
    meeting-day voting has started.
  - Reasons, notes and answers are limited to 500 characters and references
    to 200, with a counter on the page (0035, NOT VALID for older rows).
    The limits can be raised later with a migration and one constant.
  - Page layout: "1. Approve results" (required) comes first in its own
    panel, then "2. Close voting early" (optional), with count buttons at
    the top that jump to each part.
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
- Since D027 (migration 0048) `system_admin` gives no building rights:
  it does not count as a member, does not grant building roles and does
  not read consent records. It reads the building's data only through a
  temporary, read-only access opened on `/system`.

### D017 - Question Choices
Status: implemented (migration 0021)

- Multiple-choice questions are supported in V1.
- Every question gets an "Abstain" choice by default. Admin can remove it
  while setting up choices. The choice carries an abstain flag so results
  can count it as its own group.
- Changed 2026-11-18 (migration 0041): Abstain is a fixed choice. An agenda
  item has it only when the admin ticks "Has an Abstain choice" (off by
  default; some items do not need it). Its text is always "Abstain"
  ("งดออกเสียง" in Thai) and it is always last; the app cannot rename it.
  Renamed Abstain choices got the fixed text back.
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

### D020 - Owner Language
Status: implemented (migration 0027)

- `profiles.preferred_language` is `th` or `en`; Thai is the default.
- Language for a request: the signed-in profile, then the switcher cookie
  (`lang`), then Thai. Changed 2026-11-13 after the demo review: before, the
  cookie came first, so a person signing in on a browser someone else had
  switched saw the other person's language. The switcher (ไทย / EN) sets the
  cookie and saves the profile through `set_preferred_language()`, so it
  still takes effect at once. A new profile starts in the cookie's language.
- Owner-facing pages use it: home, login, consent, vote list and ballot,
  owner summary, verify page, header and navigation.
- Staff pages (admin, committee, system) follow the same rule, in three
  steps: committee, system and the admin menu and overview first, then the
  admin sections, then server messages. Their words live in
  `lib/i18n/staff/*.ts` as plain strings with `{name}` placeholders, so
  client components get them through `useStaffText()`.
- Admin actions keep returning English messages; pages show them in the
  viewer's language through `translateMessage()` (`lib/i18n/staff/messages.ts`).
  A message without a Thai entry shows in English.
- The official result record is always Thai. The English owner summary
  and the English ballot say the Thai version prevails, near the top.
- English versions of admin-typed content (migration 0032, demo review
  2026-11-13): a per-condo switch in Setup (`bilingual_documents`) asks for
  English next to the Thai meeting title, venue, agenda titles, questions,
  legal notes and choices, and English condo and juristic person names.
  Admin > Meetings > English text shows Thai beside English with a Translate
  button per line and "Translate all". Machine drafts use a fixed glossary
  of legal terms (`lib/translation/glossary.ts`); person names are
  transliterated. The admin ticks "I checked the English" before publishing;
  publishing is blocked until English is filled and checked (checked at
  publish time, not when saving a draft). After publishing only English can
  change, and the change is audited; the overview lists meetings missing
  English, and nothing blocks voting. Result snapshots copy the English;
  older ones fall back to Thai. Translation runs only when an admin presses
  the button, from the server: Azure AI Translator (free tier F0) in real
  use, or the demo list (`TRANSLATION_PROVIDER=mock`, the default without a
  key), which marks unknown text "[no demo translation]". The privacy notice
  should mention that meeting text may be sent to the translation service.
- Queued emails store the recipient's language in `email_logs.language`;
  recipients without a profile get Thai. Email text lives in
  `features/email/templates.ts` until admin-editable templates (V2).
- The privacy notice has Thai text (required) and English text (optional,
  falls back to Thai). Changing either starts a new notice version.
- Admin sets a profile's language in People > Edit roles/status. The owner
  Excel import has no language column: the language belongs to the profile,
  which is created at first sign-in.
- English after publishing (user decision 2026-11-21, migration 0050):
  readers who chose English see English where it is written and Thai where
  it is not (`localized()`, field by field), checked or not. A published
  meeting still open for voting whose English nobody checked (edited
  without the tick, or two languages turned on later) has its own card on
  the Manager's overview, apart from the drafts card. On its English page
  the Manager can check it, or "Keep as it is": nothing changes, missing
  English keeps showing in Thai, and the decision is audited
  (`meeting.english_kept_as_is`, with the number of texts without English).

### D021 - Master PDF Files Of Results
Status: implemented (migration 0028)

- When a result is published, the server makes three PDF files in the
  background (`after()`): the official record (Thai) and the owner summary
  in Thai and English. Approving does not wait for them.
- Each file is printed by headless Chromium from the same page people see,
  so screen, printout and file match. The documents use the Sarabun font
  served by the app (`lib/fonts.ts`).
- Files are stored in the private Supabase Storage bucket `result-documents`
  as `<snapshot id>/<kind>-<language>.pdf`, with SHA-256 and size in
  `result_documents`. A file is made once and not replaced.
- Downloads go through `/result-files/<snapshot id>/<file>`, which checks
  access and redirects to a 60-second signed link. Admin and committee get
  every file; other signed-in users get summaries of published results.
- If making the files fails, the result stays published and Admin > Results
  shows "Create PDF files (n/3)" to try again.
- Chromium: on Vercel `@sparticuz/chromium`; elsewhere the Chromium that
  Playwright installed, or `CHROMIUM_EXECUTABLE_PATH`.
- Google Drive backup of the files is planned later.

### D022 - Roles, Separation Of Duties, And One Owner Of Record
Status: implemented (migration 0031), decided in the demo review 2026-11-13

- Separation of duties: whoever generated a result snapshot, or answered a
  correction request of that meeting as fixed, cannot approve that result.
  Since D027 only active committee members answer on results, so the
  Manager approves only when also a member.
  A requester cannot answer their own correction request (D014). Enforced
  in the database functions.
- Auditor (`auditor` role): read only. Published results, official records,
  committee requests, correction requests and the audit log (`/audit`).
- Office staff (`staff` role): data entry only. Rooms, owners, ownership
  links, Excel import, paper ballots. Admin ("manager") keeps publishing
  meetings, results, corrections, proxies, documents, communications,
  setup and roles. A building with one officer gives both roles to the
  same person.
- `proxy` as a member status means an external proxy holder (neither owner
  nor resident). Their access lasts while they hold an approved proxy for a
  meeting that is still open; proxies stay per meeting.
- One owner of record per room: `co_owner` links ended in migration 0031,
  and a second open-ended active owner link is refused. A co-owner is
  registered as a resident. The owner of record lets them vote for one
  meeting in the app (Vote page), and can take it back until they vote. It
  is stored as a `co_owner` proxy authorization, logged, emailed, and does
  not count toward the three-room proxy limit. An owner who does not use
  the app gives a normal proxy through the office.
- The app has no record of which resident lives in which room, so the
  co-owner check is "an approved resident account with this email".
- The header shows job roles first, then the member status.

### D023 - Role Management Page (V2)
Status: accepted 2026-11-15, planned for V2 (roadmap Phase 4)

Replaces the fixed role list of D005, D016 and D022 with roles that can be
managed in the app. The database stays the source of truth: hiding a menu is
not security.

- Model: person -> roles (with start and end dates) -> permissions -> menus,
  buttons and RLS. Permissions are a fixed list in code (for example
  `rooms.edit`, `meetings.publish`, `results.generate`, `results.approve`,
  `audit.view`); roles are sets of permissions; a person can hold several
  roles. A menu shows when the person has any permission of that menu.
- Granularity: per menu, with levels such as none / view / edit / publish.
  Not per button.
- Who manages what:
  - System Admin only: the System Admin role, the "manage roles"
    permission, and the locked built-in roles.
  - Manager (admin): every other role (create, edit, copy) and who holds it.
  - No one can raise their own permissions; the last Manager cannot be
    removed. Every change is in the audit log and applies at once.
- Committee role: start and end of term are required; access ends by itself
  at the end of the term. It is kept in step with `committee_members`,
  which still decides how many approvals a result needs.
- Building scope (D009, option ข): the person-to-role table has a
  `project_id` column, empty for now ("whole system"), and checks are
  written as `has_permission(permission, project)` so a second building
  needs only a building picker, not new RLS.
- Guardrails: warn when one role or person holds permissions that should
  not go together (since D027 the role form already warns when one person
  would hold `system_admin` and a building role; `/system` lists system
  admins who also hold building roles) (for example `results.generate` with `results.approve`;
  the per-snapshot rule of D022 stays in the database); a role with
  `audit.view` cannot hold edit permissions. Owner, resident and proxy stay
  member statuses worked out from data, not assignable roles.
- Built-in roles Manager, Staff, Committee, Auditor and System Admin are
  seeded with exactly today's access, locked, and can be copied.

### D024 - Owner Record Linked To One Account
Status: accepted 2026-11-16, implemented (migrations 0037, 0038)

Before this, an owner of record and a signed-in account were matched by
email (`lower(owners.email) = lower(profiles.email)`) every time rights were
checked. Changing an owner's email silently moved the room's voting right,
with no audit entry, and office staff could do it.

- `owners.profile_id` references `profiles(id)`. One account is linked to at
  most one owner of record and one owner to at most one account (unique).
  One owner can still hold many rooms through `room_owners`.
- Rights follow the link, not the email: `room_owner_profile_id`,
  `my_member_access` and the eligible-voter snapshot built at publish use
  `owners.profile_id`. Owner email stays a contact address and the key the
  link is first made from.
- Automatic link: when an account has given the current privacy consent
  (or consent is not required), and its email matches exactly one active
  owner of record that has no account yet, the owner is linked, the account
  is approved with member status `owner`, and `owner.profile_linked` is
  written to the audit log. This runs after the consent page, at sign-in,
  and when an owner is added or its email changed. A rejected account
  is never approved automatically.
- Owner email: office staff set it when adding an owner; only an admin
  changes it afterwards, and each change is audited (`owner.email_changed`,
  addresses masked). Changing the email does not move an existing link.
- Only the link functions set `owners.profile_id` (column privileges), so a
  link cannot be written around the audit.
- Shared email: not supported. Two active owners cannot have the same email
  (unique index, case and spaces ignored). Owners who share one email need separate
  Google accounts, or one gives the other a proxy (three-room limit, D012).
- Known risk: a wrong email in the owners file links the wrong account. The
  owners page shows owners with no account and the latest account changes,
  so the admin can check new links.
- Admin link, move and unlink (migration 0038, admin only, reason required,
  audited): open meetings follow the change for rooms that have not voted
  (online or paper); rooms that already voted keep their vote. A moved-from
  account becomes a resident.
- Migration 0037 links existing owners once, with the same exact-one-match
  rule; owners it cannot link stay unlinked until the account signs in.

### D025 - Admin-Confirmed Owner Links
Status: accepted 2026-11-18, not yet implemented

D024 links an owner of record to an account automatically when the
account's email matches exactly one active owner. A wrong email in the
owners file then links the wrong person, and nobody checks who signed in.
Some condos want the office to verify each owner before they can vote.

- Setting `owner_link_mode` in `app_settings`: `auto` (D024, the default
  for every condo) or `admin_confirm`. Only an admin changes it; each change
  is audited (`settings.owner_link_mode_changed`). Changing the mode does
  not undo existing links.
- In `admin_confirm` mode no link is made automatically. An account that
  has given privacy consent and has no owner, proxy or other role waits in
  a "waiting for verification" list. It cannot vote and sees a page that
  says the office will verify it.
- The admin confirms from that list. The owner whose email matches is
  suggested, and the admin can pick another owner. Confirming needs:
  - verification method (required): ID card at the office, video call,
    phone call, known in person, document sent, or other;
  - reason / note (required, free text).
  Both are written to the audit log (`owner.profile_linked`,
  `source: admin_confirmed`, `method`, `reason`).
- The admin can also reject an account in the list (reason required). It
  stays a signed-in account with no voting rights.
- Admin link, move and unlink (D024, migration 0038) also take the
  verification method next to the reason they already require, in both
  modes.
- `auto` mode is unchanged. A link made automatically records
  `method: email_match`.
- The waiting list reuses the owners page banner, tab count and account
  history drawer (2026-11-17), so waiting accounts are seen without
  scrolling.

### D026 - Built-In Committee Positions
Status: accepted 2026-11-19 (user decision), implemented in migration 0045

The committee page took the position as free text, so the same roster mixed
languages ("Chairperson" next to "ประธานกรรมการ") and documents could not
show the position in the reader's language.

- `committee_members.position_code` holds one of seven built-in positions
  (code / Thai / English):
  - `chair` / ประธานกรรมการ / Chairperson
  - `vice_chair` / รองประธานกรรมการ / Vice chairperson
  - `secretary` / เลขานุการ / Secretary
  - `assistant_secretary` / ผู้ช่วยเลขานุการ / Assistant secretary
  - `treasurer` / เหรัญญิก / Treasurer
  - `member` / กรรมการ / Committee member (default)
  - `other` / อื่น ๆ (พิมพ์เอง) / Other (typed)
- `position_title` keeps the typed title only when the code is `other`
  (required then); a built-in position has no title. Check constraints
  enforce both.
- Existing rows were mapped once (`committee_position_code_for`): a title
  that names a built-in position in Thai or English gets its code, anything
  else becomes `other` and keeps its text.
- The committee form picks from a plain select in the page language (fixed
  values in code, so not `SearchSelect`); the title field appears only for
  `other`. The list, phone cards, filter (by code) and the committee pages
  show the label in the page language. Documents use
  `committee_position_label(code, title, lang)`: Thai by default, English
  with `en`, following the bilingual document rules; `committee_people`
  returns the Thai label as `position` plus the code and typed title.
- A new meeting's default chairperson is the active member whose code is
  `chair` (was a match on the words "chair" / "ประธาน").
- Not committee positions, so not in the list: the juristic manager (own
  field on the juristic profile), the meeting chairperson and minute taker
  (chosen per meeting, already signatory options), and the auditor (an
  outside appointee).
- Legal check pending: only the chairperson is set by the Condominium Act;
  the other positions come from each building's regulations. See
  [legal-questions.md](legal-questions.md) "Committee".

### D027 - Committee Majority, Chair's Casting Vote, System Admin Apart, Notice Flag
Status: accepted 2026-11-20 (user decisions, req_0011); implemented in
migrations 0046 and 0047 (A), 0048 (B) and 0049 (C). Legal basis: Condominium Act B.E. 2522 as
amended, sections 37/4-37/6, 42/3, 43. Calling a general meeting stays
outside the system.

A. Committee decisions (results and close-early requests), one SQL helper
`committee_tally(kind, subject)` for both:
- N = active committee members today (`active_committee_profile_ids`: an
  active `committee_members` row in term and the `committee` role), the
  chair included. n = floor(N/2)+1 (3 -> 2, 4 -> 3, 5 -> 3, 6 -> 4); the
  meeting's `required_approvals` can only raise it.
- Each member answers once: approve, or object with a reason (1-500
  characters). Answers cannot change, for results and close requests.
- Passed when approvals >= n; not passed when objections >= n.
- Tie: every member who may answer has answered and approvals =
  objections. It waits for a casting vote by the active chair (position
  `chair`, D026), else the vice chair; the casting vote is an extra,
  immutable record (`committee_casting_votes`) and is audited. With neither,
  `/committee` warns that the committee has no chair; the Manager records
  the position in Setup (the law lets the members present pick one, outside
  the system).
- A member who never answers changes nothing: the item waits; close
  requests still lapse at `ends_at`.
- Separation (D022) stays: the generator of a snapshot and whoever answered
  a correction as fixed do not answer and are not counted among those who
  may answer. A high-level correction still needs every active member, so
  one objection fails it.
- A result that is not passed: every admin is emailed once
  (`result_not_passed`), the overview shows a "Results that did not pass"
  card and the results list shows "did not pass" with the reasons. No
  automatic correction request. The Manager may generate the result again
  (approvals start from 0), which 0030 had blocked after any approval.
- Publication keeps n of N at that moment (`result_publications`:
  `committee_members`, `required_approvals`, `objections_count`,
  `decided_by_casting_vote`), shown on `/audit` and the official record.

Assumptions made where the request was silent (part A):
- Only active committee members answer on results; an admin who is not a
  member sees the progress but cannot approve (was allowed before).
- When every member who may answer has answered and neither side reached n
  and it is not a tie (possible when the meeting setting raises n), the
  result is not passed: nobody is left to change it.
- With an odd N a tie happens only when someone may not answer (separation).

Security (found while doing A, migration 0047): Supabase grants EXECUTE on
new functions in `public` to `anon` and `authenticated` by default, so the
`revoke ... from public` in earlier migrations did not make internal helpers
internal (anyone could call e.g. `publish_result_if_ready` through
`/rest/v1/rpc`). 0047 revokes them from `public, anon, authenticated`; a
new internal function must do the same (`docs/security-privacy.md`), and
`function_grants.test.sql` lists them.

B. The System Admin is apart from the building (0048):
- `system_admin` looks after condoVote (`/system`: technical settings,
  PDPA, storage, notice rule, system admins). It gives no Manager, Staff,
  Committee or Auditor rights: it no longer counts as a member
  (`is_approved_member`, `profile_member_access`), grants only
  `system_admin` (before, it could grant any role, including Manager) and
  no longer reads consent records. Sign-in itself is unchanged.
- System admins add one another by the email of an approved account and
  remove one another on `/system`; the last one cannot be removed. The
  Manager can no longer grant `system_admin`. When one person would hold
  both kinds of role, the role form and `/system` warn (D023 guardrail);
  it stays allowed for a small building.
- Temporary access: reason (1-500 characters) and 1, 4 or 24 hours
  (`system_read_access`, at most 24 hours, one open at a time per
  person, with a `project_id` for D009). While open, one extra permissive
  SELECT policy per building table lets that person read; ballot answers
  only of open ballots, like the Manager. No INSERT, UPDATE or DELETE
  policy and no write function knows the access, so every write is
  refused by the database; pages accept it only with `{ readOnly: true }`
  guards, server actions never. The committee, decisions and voter
  comment reads accept it too. Start, end early and expiry are audited;
  expiry is written when first noticed (no scheduler). The Manager's
  overview and `/audit` show "System Admin … has temporary access until
  …", the System Admin sees their own notice on every page.
- Not covered: files in Storage (documents bucket); reading a private
  document still needs a building role.

B2. Words: the role code stays `admin`; people see it as ผู้จัดการ /
Manager everywhere (roles, badges, people, audit words, help, emails,
documents, login picker). ผู้ดูแลระบบ / System admin is only
`system_admin`. The `/admin` area reads งานนิติบุคคล / Building office,
which office staff share. Functions, URLs and routes keep `admin`.

C. Notice period (0049, section 42/3): `app_settings.strict_notice_period`
(default false), switched on `/system` and audited. The meeting day is
`starts_at` (meeting-day voting), not advance voting. Publishing a meeting
less than `notice_period_days()` (7, the one place it lives) away: strict
refuses (the publish button is replaced by the reason, and a database
trigger refuses any publish); not strict shows a warning in the publish
confirm, and the publish audit row records `short_notice_confirmed` with
the days left.

