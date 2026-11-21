# Admin Workflows

These workflows define the admin-facing MVP behavior. Ask before implementing anything marked as an open question.

Roles (D022, D027): "admin" in this file is the role code `admin`, shown to people as **ผู้จัดการ / Manager**. Office staff (`staff`) do data entry: rooms, owners, ownership links, Excel import, paper ballots. The `/admin` area reads งานนิติบุคคล / Building office, which both share. The System Admin (`system_admin`) looks after the platform and has no rights in the building (see "System Admin Temporary Access").

## Room Master Data
- Admin can create, view, update, and deactivate rooms.
- Required room data: room number, ownership percentage.
- Optional room data: floor, building, area size.
- Room records should be deactivated instead of deleted after real voting data exists.
- Admin can import rooms from the locked Excel room template.

## Owner Master Data
- Admin can create, view, update, and deactivate owners.
- Required owner data: full name.
- Optional owner data: email, phone, LINE ID.
- Admin can link one or more owners to a room.
- In V1, one room can have one open non-cancelled ownership link.
- Admin can edit ownership dates, end an active owner-room relationship, or cancel a scheduled link before it becomes active.
- Ownership status is displayed as Active, Scheduled, Ended, or Cancelled. Cancelled state is stored on the ownership row and recorded in audit logs.

## Owner Accounts (D024)
- Each owner of record is linked to at most one account, and each account to at most one owner. Voting rights follow the link, not the email.
- Two active owners cannot share an email. Office staff set the email when they add an owner; only an admin changes it later (audited, link unchanged).
- Automatic link: when the owner signs in with the owner email and accepts the privacy notice, the account is linked and approved as an owner. Existing owners were linked once by migration 0037.
- Review: `Admin > Rooms & Owners > Owners` shows owners with no account and the last account changes. Check new automatic links; a wrong email in the owners file links the wrong account.
- Move an owner to a new account (lost Google account, new email):
  1. Ask the owner to sign in once with the new Google account (it waits for approval).
  2. Open the owner, enter the new account email and a reason, and press `Link or move account`.
  3. Open meetings: rooms that have not voted move to the new account; rooms that already voted keep their vote. The old account becomes a resident.
- Unlink (wrong link, owner sold the rooms): give a reason and press `Unlink account`. Rooms that have not voted in open meetings have no voter until an account is linked again; use a paper ballot if needed.
- Every link, move and unlink is in the audit log with who did it and the reason (`owner.profile_linked`, `owner.profile_moved`, `owner.profile_unlinked`).

## User Approval
- Admin can review registered profiles.
- Admin can approve or reject owner eligibility requests.
- Admin can approve or reject proxy eligibility requests.
- Admin should see the requested room, requester profile, supporting notes, and linked documents.
- Approved profile eligibility is still converted into meeting-specific eligibility through `eligible_voters_snapshot`.

## Proxy Approval
- Proxy approval is scoped to one meeting and one room.
- One proxy can hold at most three rooms per meeting (D012).
- An approved proxy is the only voter for that room in that meeting (D011).
- Admin can approve, reject, or revoke proxy authorization.
- Proxy authorization should reference the owner, proxy profile, room, meeting, validity window, and supporting document if provided.

## Meeting Setup
- Admin can create, edit, and archive meetings.
- Admin can maintain juristic-person profile data used as the issuer identity for generated documents.
- Admin can maintain committee member names, positions, term dates, and active status for document approval/signature context.
- Admin can set title, meeting number, meeting type, fiscal year, location/platform, chairperson, quorum rule, voting start/end time, optional video URL, and optional transcript.
- Admin can create, edit, delete, and reorder questions.
- Admin can define agenda number/title, resolution type, approval threshold, legal note, and land-office registration flag per question.
- Admin can create, edit, delete, and reorder choices.
- Admin chooses open or secret ballot when creating the meeting (D015). It cannot change after publishing. For a secret ballot, the conflict review hides online answers; admin chooses the source from ballot times and the paper record.
- Admin chooses single or multiple choice per question (D017).
- New questions get an "Abstain" choice by default; admin can remove it (D017).
- Admin sets each question's pass rule: basis (voting ownership or total ownership) and percentage (D013).
- Admin can add an optional advance voting window before meeting day. Leave it empty for one voting window (D019).
- On `Admin > Meetings > Meeting record`, admin records the notice date, first or reconvened meeting, how attendees proved who they are, where the recording and logs are kept, and incidents during voting. Generate results again after changes; they are frozen into the snapshot.
- On `Admin > Setup`, admin chooses who signs the official record and the result notice period.
- In `People > Edit roles/status`, admin sets a profile's language (Thai or English, D020). Owners can also change it with the language switch.
- Admin can preview a meeting before publication.
- Admin can publish a meeting when the setup is complete.
- Setup order (2026-11-18 review): add the meeting, then its agenda opens. A draft meeting's agenda page shows the steps: details, agenda and choices, English (when documents are in two languages), check and publish.
- The agenda form belongs to one draft meeting. Fields that apply only to some items (max choices, custom pass rule) appear only then. New agenda items and choices go last; order is under "More settings".
- In the meeting list, a draft shows its next step (agenda, English, or Publish); other actions are under "More". Newest meetings come first.

## Publishing
- Publish asks first, with the number of agenda items and the voting window.
- Notice period (D027 C, Condominium Act s.42/3): the meeting day (`starts_at`) should be at least 7 days away (`notice_period_days()`). The System Admin's setting decides. With strict off (default), the publish confirm adds a warning, and the publish audit row records `short_notice_confirmed`. With strict on, the Publish button is replaced by the reason, and the database refuses the publish.
- Publish needs at least one agenda item, and every item needs a choice other than Abstain (`features/admin/meeting-readiness.ts`, checked again in `publishMeeting`). After publishing, agenda items and choices are locked (0039).
- Publishing should freeze or refresh the meeting's `eligible_voters_snapshot`.
- After publication, invitation emails can be queued for eligible voters.
- Editing published meetings should be restricted. If allowed, it must be audited.

## Closing Voting
- Voting closes automatically at `ends_at`.
- Closing early starts with a request from a committee member or the Manager, with a reason. Only active committee members answer, once each; an answer cannot change (D027).
- The number needed is a majority of all active members, the chair included (N/2 rounded down, plus 1; 3 of 5, 3 of 4, 4 of 6). The meeting's setting can only raise it. Voting closes when approvals reach it. The request fails when the same number object, or when everyone answered without reaching it. A tie waits for the chair's casting vote, or the vice chair's when there is no chair.
- Committee members can ask for a result correction. Admin > Results lists open requests: answer each one, and raise the level when needed. While a request is open, the result can be generated again (D014).
- Every close approval is audited.

## Private Document Registry
- Admin can choose `local_drive` or `google_drive` from `Admin > Setup`.
- Admin stores a root path or private Google Drive folder link. Credentials remain outside the database.
- Admin manages document references from `Admin > Documents`.
- Admin can register a private document reference with its owner record, type, path or private link, document set key, version, filename, MIME type, file size, and SHA-256 checksum.
- The document registry supports search by document set and type, and sorting by set, type, and created timestamp.
- V1 registers references and verification metadata only. Direct file upload and Google Drive API sync are deferred until the credential and sharing policy is approved.
- Use the same document set key for revisions of one logical document and increment the version.

## Business Audit Log
- Admin can inspect recent business audit entries from `Admin > Setup`.
- Audit entries include actor, action, entity type, entity ID, JSON details, and timestamp.
- Current audited actions include meeting publication, profile approval, proxy create/review, manual vote import, online/manual conflict resolution, ballot submit/update, result snapshot generation/approval, storage setting changes, and document registration.

## Excel Master Data Import
- The Manager and office staff open `Building office > People > Import` (`/admin/people/import`); anyone else is sent back home. The page and the import actions use the same rule (`requireOfficeStaff`).
- Admin can download locked Excel templates from `Admin > People`.
- Master imports are separated by table: `rooms-import-template.xlsx`, `owners-import-template.xlsx`, and `room-owners-import-template.xlsx`.
- Each template has one import sheet with protected headers, validation lists, and unlocked input rows.
- Rooms are imported by upsert using `room_number` as the key.
- Owners are imported by upsert using `email` as the key.
- Room-owner links import `room_number` and `owner_email`; `ownership_role` is fixed as `owner`, and ownership dates are intentionally omitted.
- The import supports only `upsert`; deleting or deactivating master data must be done from the relevant update/edit menu.

## Result Management
- Admin starts manual vote import from `Admin > Voting` by choosing meeting, room, and the person who used the voting right at the meeting.
- If the voter is already registered, admin links the manual vote to that profile.
- If the voter is not registered yet, admin can enter a free-text identity; the manual vote is saved with `identity_status=pending` as a draft and is not used for result calculation until the voter is registered and linked to a profile.
- Pending manual vote identity records block result generation and committee approval. Admin must resolve them from `Admin > Voting > Manual votes` before continuing the result process.
- To resolve a pending manual vote identity, admin opens the pending manual identity row, selects the matching registered profile, and saves. The ballot is then marked `identity_status=linked` and `status=submitted`.
- Existing manual ballots from before this identity design are marked `identity_status=legacy` to preserve dev data and result history.
- Manual vote entry redirects to the admin manual vote form and uses the same question/choice layout as online voting.
- Manual votes are stored as `manual_ballots` and `manual_ballot_answers`, parallel to online `ballots` and `ballot_answers`.
- If the same room has submitted online votes and imported manual votes, admin reviews the conflict from `Admin > Voting > Manual/Online Conflicts`.
- Conflict review shows a read-only side-by-side diff of manual and online answers, highlights different answers, and requires choosing one whole source only. Manual is the default selected source.
- Conflict resolution references the online ballot ID and manual ballot ID directly, and must include a remark when relevant.
- Admin can generate a result snapshot only after voting closes: after `ends_at`, or after committee approvals to close reach the minimum. While voting is open the meeting list shows "Voting open" instead of "Generate result" (D014).
- Admin/committee can review the result snapshot.
- Committee approval notes should mention material manual/online conflict handling before approving the result.
- `result_publications` is the source of truth for publication; each approver's record stays in `committee_approvals`.
- Committee members answer on the Committee page (`/committee`): approve, or do not approve with a reason (1-500 characters). Each member answers once; an answer cannot change. Only active committee members answer. A Manager who is not on the committee sees the progress but has no Approve button (D027).
- A result is published when approvals reach the majority of active members ("Needs n of N"); the meeting's `required_approvals` can only raise it. A high-level correction still needs every active member. Whoever generated the result, or answered a correction of it as fixed, does not answer on it (D022).
- **Did not pass**: when as many members do not approve as the number needed, or when everyone answered without reaching it. Every Manager is emailed (`result_not_passed`). The overview shows "Results that did not pass", and Results has a "Did not pass" filter that shows the reasons. Fix what is wrong and generate the result again; approvals start from 0.
- **Tie**: everyone who may answer has answered and approvals equal objections. The chair (vice chair when there is no chair) casts the deciding vote on `/committee`; it is a separate record in the audit log. With neither, `/committee` warns that the committee has no chair; record the position in Setup > Committee.
- The publication keeps n of N on the day (`committee_members`, `required_approvals`, `objections_count`, `decided_by_casting_vote`), shown on `/audit`, the official record and the results list.
- After committee approval, the approved result snapshot and approval record are immutable.
- After committee approval, generating another result snapshot for the same meeting is blocked, unless a correction request is open or the latest result did not pass.
- Approved results can be viewed, exported to PDF, and sent by email.
- `View record (web page)` (Thai: `ดูบันทึกผล (หน้าเว็บ)`) on the results list opens `/record/[snapshotId]`; print it or save it as PDF from the browser, then sign and keep it (D019). `Back` above the record returns to the Results section, or to Audit when it was opened from there.
- When a result is published the master PDF files are made in the background (D021). `Download official PDF` (Thai: `ดาวน์โหลด PDF ฉบับทางการ`) downloads the frozen official file; `Create PDF files (n/3)` makes any that are missing.

## English After Publishing (D020)
- Readers who chose English see English where it is written and Thai where it is not, field by field, whether or not the English was checked.
- English can still be edited after publishing (Thai is locked). Saving without the "checked" tick clears the check.
- The overview's "Published meetings: English not checked" card lists published meetings still open for voting whose English nobody checked. It is separate from the drafts card, because drafts cannot be published until their English is done.
- On the meeting's English page, either check the English, or press "Keep as it is (no change)". With "Keep as it is", nothing changes and missing English keeps showing in Thai. Who decided is kept, and the audit log records `meeting.english_kept_as_is` with the number of texts without English (migration 0050).

## System Admin Temporary Access (D027 B)
- The System Admin cannot open the Building office, Committee or Audit pages, cannot grant building roles, and does not count as a member.
- To help with a problem, the System Admin opens read-only access on `/system`: a reason, and 1, 4 or 24 hours. It can be ended early. While it is open, the building's pages open read only, and every change is refused by the database.
- Start, end and expiry are in the audit log. The Manager's overview and `/audit` show "System Admin … has temporary access until …" with the reason.
- System admins add and remove one another on `/system`; the last one cannot be removed. The Manager's role form warns when one person would hold both a building role and System admin (D023 guardrail).

## Resolved Questions (2026-11-08, updated 2026-11-21)
- Result approval: multiple committee members. Since D027 a majority of all active members is needed; the meeting's setting can only raise it, and the chair breaks a tie.
- Closing before `ends_at`: by committee approvals reaching the same majority, not by a single admin (D014, D027).

## Open Questions
- Should published questions/choices be locked completely after the first vote?
- Should room/owner deletion be blocked entirely once linked to voting history?
