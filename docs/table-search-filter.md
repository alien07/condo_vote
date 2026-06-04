# Table Search, Sort, Filter, And Pagination

This document is the reference for admin list/table UX.

## Pattern

- Keep search criteria and results in separate sections.
- Search criteria uses query params so refresh/share/back preserve state.
- Use server-side filtering, sorting, and pagination for large or audit-sensitive tables.
- Use client-side filtering only for small already-loaded lookup data.
- The primary action label is `Search`; secondary action is `Clear`.
- If action buttons do not fit the criteria row, wrap them to a centered row.
- Results show total count, current range, current page, and next/previous controls.
- `Per page` belongs with result controls near page status, not in search criteria.
- Changing `Per page` applies immediately on change and preserves current criteria/sort.
- Search must preserve the current `perPage`; only `Clear` returns it to default.
- Prefer client result updates for Search, Clear, Sort, Pagination, and `Per page`
  when the user is staying in the same workspace. The client still calls a
  server-side query endpoint and syncs URL params with `history.replaceState`
  so refresh/share preserve state.
- App Router navigation is acceptable for first-load deep links and simple
  server-rendered tables, but should not be required for every result update
  when it causes visible full-page re-render.
- Table header, data rows, and odd/even rows must be visually distinct.
- Date/time display format is `dd/MM/yyyy HH:mm:ss`; date and time may be split across two lines in tight columns.
- `datetime-local` criteria inputs use `step=600` for 10-minute picker increments. Users can still manually type other minute values.

## Query Contract

Common params:

- `tab`: workspace section.
- `q`: phrase search, usually minimum 3 characters before suggestion/typeahead.
- `from`, `to`: inclusive date/time range.
- `sort`: column key.
- `dir`: `asc` or `desc`.
- `page`: 1-based page number.
- `perPage`: 10, 25, 50, or 100.

Table-specific filters may add params such as `actor`, `actions`, `status`,
`meeting`, `room`, or `proxy`.

## Typeahead

Use React Aria Components for the Combobox/Autocomplete layer when typeahead is
implemented. Keep table query logic server-side with URL params.

Phrase search behavior:

- Start suggestions after 3 characters.
- Use prefix matching semantics, equivalent to `abc*`.
- Selecting a suggestion writes the stable identifier or canonical filter value
  to the URL query.

## Current Pilot

`/admin/setup?tab=audit` is the first implemented table pilot:

- Filters: Time range, Actor, Action.
- Sort: Time, Actor, Action, Entity. Details is not sortable.
- Pagination: `page` and `perPage`.
- Server-side query: `audit_logs` with exact count.
- Result updates: client fetches `/api/admin/audit-logs` and updates only the
  criteria/results component state while keeping query params in sync.

## Rollout List

- Private Document Registry: layout cleanup and table search later.
- Business Audit Log: pilot implemented first.
- Committee Members: Name, Position, Status.
- Manual Votes: Meeting, Room.
- Meetings: Title, No./Type, Status.
- Result Snapshots: Meeting, Generated, Approval.
- Email Delivery Logs: Recipient, Status, Created.
- Rooms: Room, Status.
- Owners: Name, Status.
- Profiles: Name, Default status.
- Room Ownership: Room, Owner.
- Proxy Authorizations: Meeting, Room, Proxy.

## Relationship To CRUD Flow

Use this after the CRUD drawer/list pattern in `admin-crud-flow.md`. CRUD actions
remain inline row actions or drawer actions; this document governs list criteria,
sort, result display, and pagination.
