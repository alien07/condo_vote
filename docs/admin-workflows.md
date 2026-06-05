# Admin Workflows

These workflows define the admin-facing MVP behavior. Ask before implementing anything marked as an open question.

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
- Admin can end an owner-room relationship when ownership changes.

## User Approval
- Admin can review registered profiles.
- Admin can approve or reject owner eligibility requests.
- Admin can approve or reject proxy eligibility requests.
- Admin should see the requested room, requester profile, supporting notes, and linked documents.
- Approved profile eligibility is still converted into meeting-specific eligibility through `eligible_voters_snapshot`.

## Proxy Approval
- Proxy approval is scoped to one meeting and one room.
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
- Admin can preview a meeting before publication.
- Admin can publish a meeting when the setup is complete.

## Publishing
- Publishing should freeze or refresh the meeting's `eligible_voters_snapshot`.
- After publication, invitation emails can be queued for eligible voters.
- Editing published meetings should be restricted. If allowed, it must be audited.

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
- Admin can generate a result snapshot after voting closes.
- Admin/committee can review the result snapshot.
- Committee approval notes should mention material manual/online conflict handling before approving the result.
- `committee_approvals` is the source of truth for publication approval.
- After committee approval, the approved result snapshot and approval record are immutable.
- After committee approval, generating another result snapshot for the same meeting is blocked.
- Approved results can be viewed, exported to PDF, and sent by email.

## Open Questions
- Should published questions/choices be locked completely after the first vote?
- Should result approval require one committee member or multiple committee members?
- Should admin be allowed to manually close a vote before `ends_at`?
- Should room/owner deletion be blocked entirely once linked to voting history?
