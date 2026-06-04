# Admin CRUD Flow

This document is the reference for admin create, read, update, and deactivate UX.

## Current Pilot

`/admin/people` is the pilot page for this pattern. The first rollout batch
applies the same drawer/list pattern to admin workspaces:

- `/admin/setup?tab=committee`: add committee member in drawer; deactivate remains an inline row action.
- `/admin/proxies`: add proxy authorization in drawer; review proxy status opens from the target row in a drawer.
- `/admin/setup?tab=storage`: register private document reference in drawer; storage config remains inline because it is a single settings form.
- `/admin/voting`: import manual vote in drawer; conflict resolution remains inline on the conflict row.
- `/admin/ownership`: create ownership link in drawer; end active link remains inline on the ownership row.
- `/admin/meetings?tab=meetings`: add meeting in drawer; publish/archive/result generation remain inline row actions.
- `/admin/meetings?tab=questions`: add agenda question in drawer; choices remain inline under their parent question.
- `/admin/results`: approve result in drawer from the result row.

Search/filter forms and single-record configuration forms do not need drawers.

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

- Prefer `Deactivate`, `Reactivate`, `Archive`, `Revoke`, or `End active link` over hard delete.
- Confirm before any destructive/status-changing action.
- Confirm text must include target item and business effect.

## Next Reference

After the CRUD pilot is accepted, continue with `docs/table-search-filter.md` for shared table search, sort, filter, and pagination behavior.
