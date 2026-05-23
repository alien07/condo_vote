# Requirements

## Goal
Build a low-cost online survey/voting application for condominium meetings.

## Roles
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
- Each room has an ownership percentage for weighted calculation.
- Voter can edit vote while the voting window remains open.
- The latest submitted ballot version is the effective vote.
- Voting is closed outside the configured start/end time.

## Result Rules
For each choice, calculate:
- Vote count by room.
- Ownership-weighted percentage against total project ownership.
- Ownership-weighted percentage against submitted-vote ownership.

Results are hidden until committee/admin approval.

After voting closes and committee/admin approval is recorded, result summaries should be sent by email to owners and residents. Delivery may be queued because daily email limits can apply.

Communication details: [communication.md](communication.md).

## Non-Goals For MVP
- Native LINE login.
- Uploading video files into Supabase Storage.
- Payment, billing, or multi-tenant SaaS packaging.
- Legal-grade digital signature workflow.

## Open Questions
- Exact committee approval authority: one admin approval or multiple committee approvals?
- Exact legal wording for proxy documents.
- Whether multiple owners of one room need individual consent before one room vote is accepted.
- Whether abstain is a required choice for every question.
