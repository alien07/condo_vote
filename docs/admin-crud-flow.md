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

4. `/admin/setup?tab=storage`
   - Register private document reference opens in drawer.
   - Storage provider settings remain inline because they are single-record app configuration.

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

## Destructive Actions

- Prefer `Deactivate`, `Reactivate`, `Archive`, `Revoke`, `End Link`, or `Cancel scheduled link` over hard delete.
- Confirm before any destructive/status-changing action.
- Confirm text must include target item and business effect.

## Next Reference

After the CRUD pilot is accepted, continue with `docs/table-search-filter.md` for shared table search, sort, filter, and pagination behavior.
