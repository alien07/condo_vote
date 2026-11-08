# Requirements

## Goal
Build a low-cost online survey/voting application for condominium meetings.

## Roles
- System admin: manages technical, service, and maintenance settings, including PDPA notice and data retention (D016).
- Admin: manages master data, meetings, questions, choices, voter approvals, proxy approvals, and result approval.
- Committee: reviews and approves final results before publication.
- Owner voter: votes for owned rooms.
- Proxy voter: votes for a room only after admin approval.
- Resident: may register but cannot vote unless approved as proxy.

## Meeting And Survey
- Admin can create a meeting or voting event.
- Admin can set title, description, optional video URL, optional transcript/caption text, start time, and end time.
- Admin can create, update, remove, and reorder questions.
- Admin can create, update, remove, and reorder choices per question.
- Admin chooses open or secret ballot when creating a meeting (D015).
- Questions can be single choice or multiple choice (D017).
- Every question gets an "Abstain" choice by default; admin can remove it (D017).
- Admin sets each question's pass rule: a basis and a percentage (D013).
- Admin can publish a meeting when ready.
- Voting link can be sent to registered email addresses.
- Meeting history must be retained.

Detailed admin behavior: [admin-workflows.md](admin-workflows.md).

## Voter Registration
Required profile fields:
- Full name
- Email
- Room number
- Status: owner, resident, or proxy
- Ownership percentage or room ownership metadata
- Phone number
- LINE ID, optional
- PDPA consent, collected at registration (D016)

## Approval
There are two approval flows:
- Voter eligibility approval: admin verifies owner or proxy eligibility before the ballot is counted.
- Result approval: committee/admin approves calculated results before they are visible publicly.

Possible owner verification sources:
- Juristic office master data
- Ownership document reference
- Admin-reviewed supporting document

Possible proxy verification sources:
- Proxy authorization document
- Owner identity reference
- Meeting-specific proxy authorization

## Voting Rules
- Only owners can vote by default.
- Residents cannot vote unless approved as proxy.
- One room equals one voting right.
- If a meeting has an approved proxy for a room, only that proxy can vote for the room. Otherwise the first eligible voter to submit locks the room (D011).
- One proxy can hold at most three rooms per meeting (D012).
- Each room has an ownership percentage for weighted calculation.
- The voter who holds the room's voting right can edit the vote while the voting window remains open.
- The latest submitted ballot version is the effective vote.
- Voting is closed outside the configured start/end time.
- Voting closes automatically at the end time, or earlier when committee approvals to close reach the configured minimum (D014).

## Result Rules
For each choice, calculate:
- Vote count by room.
- Ownership-weighted percentage against total project ownership.
- Ownership-weighted percentage against submitted-vote ownership.

Each question passes or fails by its configured rule (D013):
- Basis: ownership of rooms that voted, or total project ownership.
- Percentage: set by admin, for example 50%.
- Abstain is shown as its own group and counts as voting.

Room counts are shown for information. Pass/fail uses ownership-weighted values.

Results are hidden until the number of committee approvals reaches the configured minimum (D014).

After voting closes and committee/admin approval is recorded, result summaries should be sent by email to owners and residents. Delivery may be queued because daily email limits can apply.

Communication details: [communication.md](communication.md).

## Non-Goals For MVP
- Native LINE login.
- Uploading video files into Supabase Storage.
- Payment, billing, or multi-tenant SaaS packaging.
- Legal-grade digital signature workflow.

## Resolved Questions (2026-11-08)
- Committee approval authority: multiple approvals, minimum set by admin (D014).
- Co-owner consent before one room vote: not required (D011).
- Abstain: default choice on every question, removable by admin (D017).

## Open Questions
- Exact legal wording for proxy documents.
- Lawyer confirmation of the legal presets for pass rules (Condominium Act sections 48 and 49).
