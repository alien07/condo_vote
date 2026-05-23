# Admin Workflows

These workflows define the admin-facing MVP behavior. Ask before implementing anything marked as an open question.

## Room Master Data
- Admin can create, view, update, and deactivate rooms.
- Required room data: room number, ownership percentage.
- Optional room data: floor, building, area size.
- Room records should be deactivated instead of deleted after real voting data exists.
- Admin can import rooms from CSV in a later hardening phase.

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
- Admin can set title, description, voting start/end time, optional video URL, and optional transcript.
- Admin can create, edit, delete, and reorder questions.
- Admin can create, edit, delete, and reorder choices.
- Admin can preview a meeting before publication.
- Admin can publish a meeting when the setup is complete.

## Publishing
- Publishing should freeze or refresh the meeting's `eligible_voters_snapshot`.
- After publication, invitation emails can be queued for eligible voters.
- Editing published meetings should be restricted. If allowed, it must be audited.

## Result Management
- Admin can generate a result snapshot after voting closes.
- Admin/committee can review the result snapshot.
- `committee_approvals` is the source of truth for publication approval.
- Approved results can be viewed, exported to PDF, and sent by email.

## Open Questions
- Should published questions/choices be locked completely after the first vote?
- Should result approval require one committee member or multiple committee members?
- Should admin be allowed to manually close a vote before `ends_at`?
- Should room/owner deletion be blocked entirely once linked to voting history?
