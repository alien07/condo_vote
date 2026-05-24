# Voting Flow

The voter assignment list is `/vote`. A specific ballot is opened at `/vote/[meetingId]/[roomId]`.

## Current Scope
- Signed-in users see meeting/room assignments from `eligible_voters_snapshot`.
- The assignment list links each eligible meeting/room to a dedicated ballot detail page.
- A voter can submit one ballot per eligible meeting and room.
- A voter can edit the submitted ballot while the meeting is still `published` and inside the voting window.
- The ballot detail page includes a pre-submit review note and displays the latest submitted version/time.
- Each submit/update writes the current `ballots` row, upserts `ballot_answers`, and inserts a new `ballot_versions` record.
- Closed or out-of-window meetings render existing ballot status but disable submit/update.

## Access Rules
- Voters can read only eligible meetings, rooms, questions, choices, their own eligible snapshot rows, their own ballots, their own answers, and their own ballot versions.
- Voters can insert/update ballots only when:
  - the meeting is `published`
  - the current time is within `starts_at` and `ends_at`
  - the room/meeting/profile combination exists in `eligible_voters_snapshot`

## Admin Interaction
- Online ballots share result calculation with manual ballots.
- If the same room has both online and manual ballots, admin must resolve the source conflict before generating results.
