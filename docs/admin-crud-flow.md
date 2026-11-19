# Admin CRUD Flow

This document is the reference for admin create, read, update, and deactivate UX.

## Current Pilot

`/admin/people` is the pilot page for this pattern. Rollout must continue one
page at a time. After each page is implemented, run the page-specific smoke
test, commit the page, and wait for user confirmation before starting the next
page.

Search/filter forms and single-record configuration forms do not need drawers.

## Rollout Plan

1. `/admin/meetings?tab=meetings`
   - Add meeting opens in drawer.
   - Draft meetings can be edited in drawer.
   - Non-draft meetings are read-only for edit; publish, archive, and result generation remain inline row actions.
   - Success closes drawer, preserves table state, and focuses the affected row when it is still visible.

2. `/admin/meetings?tab=questions`
   - Add agenda question opens in drawer.
   - Question edit opens from the target row.
   - Choices remain inline under their parent question until a separate choice-management design is needed.

3. `/admin/setup?tab=committee`
   - Add committee member opens in drawer.
   - Edit committee member opens from the target row.
   - Deactivate/reactivate remains an inline row action with confirmation.

4. `/admin/setup?tab=storage` and `/admin/documents`
   - Storage provider settings remain inline because they are single-record app configuration.
   - `Go to documents →` links to the private document registry.
   - Register document opens in a drawer on `/admin/documents?mode=create`,
     in three groups: whose document (document type, "Document of", then a
     `SearchSelect` of people, proxies, approval requests, meetings or
     results that submits the record id), where the file is (storage,
     folder path or private Drive link), and check data (folded, optional).
     "Choose file to calculate" reads a file on this device and fills the
     file name, type, size and SHA-256; the file is never uploaded.
     Document set and version are worked out when left empty
     (review 2026-11-19).
   - Each row: View details (`mode=view&id=`: full path and checksum, size,
     type, who registered it and when) and Register new version
     (`mode=create&from=<id>`: same owner and set, next version).
   - Filters: room and owner (`SearchSelect`, `?room=<id>`, `?owner=<id>`)
     and document type; phones get cards, md and up the table.

5. `/admin/proxies`
   - Add proxy authorization opens in drawer.
   - Review/edit status opens from the target row in drawer.
   - Revoke/deactivate remains inline with confirmation.

6. `/admin/ownership`
   - Create ownership link opens in drawer.
   - Edit dates opens in drawer from the target row.
   - End Link opens a confirmation drawer with an editable effective end date.
   - Cancel scheduled link remains inline with confirmation.

7. `/admin/voting`
   - Manual vote import opens in drawer.
   - Manual vote edit opens from the target row.
   - Conflict resolution stays on the conflict page because it needs a read-only manual/online comparison.

8. `/admin/results`
   - Approval action opens from the result row in drawer.
   - Result generation remains inline on Meetings because pending manual votes must block generation before committee approval.

Each rollout step must keep the current page layout stable enough for user live
testing before the next page starts.

The pilot is split into focused tabs:

- `Rooms`: room master data and `Add room`
- `Owners`: owner master data and `Add owner`
- `Profiles`: profile status and app role access

`/admin/people` defaults to `Rooms`. Legacy `tab=people` maps to `Rooms`.

## Pattern

- List/search stays as the main workspace.
- Create and edit forms open in a right overlay drawer on desktop.
- Mobile uses a full-width drawer/page.
- Row actions are inline so the target record is clear.
- No create/edit form appears above a table.
- No vertical `Search / Insert / Edit` tabs.

## URL State

Drawer state is stored in query params:

- `mode=create&type=room`
- `mode=edit&type=room&id=<room-id>`
- `tab=owners&mode=create&type=owner`
- `tab=owners&mode=edit&type=owner&id=<owner-id>`
- `tab=profiles&mode=edit&type=profile&id=<profile-id>`

Closing the drawer removes `mode`, `type`, and `id`, while preserving `tab` and future table search params.

## Drawer Rules

- Selected row is highlighted while editing.
- Drawer header shows only key fields for the selected record.
- Save/create success closes the drawer and shows global feedback.
- Validation errors keep the drawer open.

## Validation Rules

- Required fields use a red `*`.
- Forms show `Fields marked with * are required.`
- Validation failure shows:
  - form-level error summary
  - field-level error text
  - `aria-invalid="true"`
  - `aria-describedby` linking fields to errors
- The first invalid field receives focus.
- User-entered values remain in the form.
- Room `ownership_percent` must be greater than `0` and less than or equal to `100`.
- Database constraint errors for room ownership percentage must map back to the `ownership_percent` field.
- Use natural DOM tab order; do not use positive `tabIndex`.

## Action Feedback

Standard since 2026-11-19: every admin action tells the user what happened.

- Success ends on the same page with a short message in the shared banner
  (`feedback=success&message=...`), for example "Room deactivated".
- Failure ends on the same page with the reason (`feedback=error`), never on
  an error page. A row still used by other records (database error 23503)
  gets a plain sentence, for example "This agenda item has votes and cannot
  be deleted."
- Drawer forms (`useActionState`) already return `success` or `error`.
  Buttons and small forms without a drawer use `withFeedback()` from
  `features/admin/action-modules/feedback.ts`, or a page-specific helper that
  does the same (agenda: `backToAgenda`, meeting record: `done`, committee:
  `runAndRedirect`).
- Messages are English in code; add the Thai to `lib/i18n/staff/messages.ts`.

## Meeting Pickers

Standard since 2026-11-19: a form that picks a meeting lists only the
meetings where what it saves still means something, with the state as the
hint (never the raw status code). The server checks the same rule; the
database too where a wrong meeting would change a result.

| Form | Meetings offered | Rule | Database |
| --- | --- | --- | --- |
| Add agenda item | Draft | `question-crud-drawer.tsx` | 0039 `AGENDA_LOCKED` |
| Add proxy | Draft, or published and voting not ended | `takesNewProxy` (`proxy-meetings.ts`) | 0020 trigger after publish |
| Paper ballot | Published, until the result is generated (also after voting ends) | `takesPaperBallots` (`meeting-pickers.ts`) | 0044 `VOTE_CLOSED` |
| Send vote links | Published and voting not ended | `takesVoteInvitations` (`meeting-pickers.ts`) | - |

Search filters on list pages (meeting name boxes) still match every meeting.

## Destructive Actions

- Prefer `Deactivate`, `Reactivate`, `Archive`, `Revoke`, `End Link`, or `Cancel scheduled link` over hard delete.
- Confirm before any destructive/status-changing action.
- Confirm text must include target item and business effect.

## Next Reference

After the CRUD pilot is accepted, continue with `docs/table-search-filter.md` for shared table search, sort, filter, and pagination behavior.
