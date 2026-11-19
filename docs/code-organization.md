# Code Organization Policy

Status: accepted, see [D008](decisions.md#d008---modular-monolith-organized-by-domain).

condoVotes is a **modular monolith**: one Next.js app, one Supabase project,
one deployment. Code is split into modules by business domain so each part is
small and easy to change. It is not split into microservices.

## Why Not Microservices
- One condominium with hundreds of users does not need independent scaling.
- Separate services add hosting cost, which conflicts with
  [D007](decisions.md#d007---free-tier-constraints-shape-mvp-architecture).
- Voting needs database transactions across ballots, answers, versions, and
  audit logs. Splitting these across services makes atomic writes much harder.

Background work (email delivery, PDF generation, scheduled vote closing) can
run as Supabase Edge Functions. These still live in this repository and use
the same domain names.

## Domains
| Domain | Covers |
| --- | --- |
| setup | Juristic profile, document storage settings, committee members, audit log |
| people | Rooms, owners, profiles and roles, room ownership |
| meetings | Meetings, agenda questions, choices, publishing |
| voting | Online ballots, manual ballots, online/manual conflicts |
| proxies | Proxy authorizations |
| results | Result snapshots, committee approval, PDF summary |
| communications | Email invitations, notifications, delivery logs |
| documents | Private document registry |
| auth | Login, session, profile bootstrap, role checks |
| summary | Owner-facing approved result pages |

## Layout
```text
features/admin/
  action-modules/<domain>.ts          server actions for one domain
  data-modules/<domain>.ts            data loading for one domain
  components/
    admin-workspace.tsx               loads data and picks the active section only
    sections/
      types.ts                        shared section and filter types
      shared/                         helpers used by several domains
      <domain>/
        <feature>-section.tsx         one admin section
        <feature>-panel.tsx           one tab or table inside a section
        <feature>-form.tsx            one form or drawer body
        <feature>-hrefs.ts            URL builders for one table
        <feature>-table-state.ts      URL/search state for one table
```

## Rules
1. **One domain per module.** A file belongs to exactly one domain. Put it in
   that domain's folder.
2. **File size.** Aim for 400 lines or less. Above 600 lines a source file must
   be split. Split by sub-feature: a panel, a form, a drawer, a table, URL
   helpers, or table state. Generated files such as
   `lib/supabase/database.types.ts` are exempt.
3. **State lives with its section.** Filtering, sorting, and paging state is
   computed inside the section that renders it. Only state used by several
   domains goes in `sections/shared/derived.ts`.
4. **Domains do not import each other's internals.** Share code through
   `sections/shared/` or `sections/types.ts`.
5. **Client boundary.** Add `"use client"` only to files that need hooks or
   browser APIs. Keep sections as server components when they can be.
6. **Refactors keep behavior.** A move-only refactor must not change UI text,
   markup, or data flow. Verify with lint, typecheck, build, and e2e.
7. **One standard for controls (review 2026-11-15).**
   - Every control has a tap area of at least 44 x 44 px: `min-h-11` on
     buttons and fields, or the `tap-target` class (app/globals.css) on
     controls drawn smaller, such as the "i" button.
   - Typed text (reasons, notes, answers) is shown with `LongText`
     (features/ui/long-text.tsx) and typed into `CountedText` with a limit.
   - A choice between actions is one row of buttons of similar weight; a
     form that one of them needs opens below the row, and ends with
     [Cancel] [Send ...] on the right.
   Admin tables are brought in line during the admin review.
8. **Long lists are searched, not scrolled (2026-11-18).** A choice from a
   list that can grow with the condo (rooms, owners, people) uses
   `SearchSelect` (features/ui/search-select.tsx): type a room number,
   name, email or phone; each row shows a hint (floor, current owner,
   email) so the right one is picked. It submits through a hidden input,
   and its box has `data-focus-for` for "focus the first field with an
   error". In e2e use `chooseSearchOption` (tests/e2e/admin/admin-helpers.ts).
   Use the shared builders `roomSearchOptions`, `ownerSearchOptions`,
   `profileSearchOptions` and `invalidFieldElement` from the same file.
   Done: room-owner link, proxies (room, owner, proxy holder), paper
   ballots (room, voter), committee (person).
   **Rule of thumb (2026-11-19):** if the choices are rows in the database
   (meetings, rooms, owners, people), use `SearchSelect` and submit the
   row's **id**, never its title or name (titles change and repeat). If
   the choices are fixed values in code (status, type, language, page
   size), keep a plain `<select>`. Meetings use `meetingSearchOptions`
   (features/ui/search-options.ts, callable from server components) with
   a hint that fits the form (closing time, status). Meetings done: agenda
   picker, proxies, paper ballots, vote invitations; audit log actor
   filter; Results page meeting filter (pilot, `?meeting=<id>`).
   **Filters (rolled out 2026-11-19):** a list filter on a meeting or a
   room is a `SearchSelect` whose value is the id (`?meeting=<id>`,
   `?room=<id>`), and the list compares ids, never part of a title or
   room number. It offers only the meetings or rooms that appear in that
   list, so every choice finds something; the placeholder is
   `s.common.allMeetings` / `s.common.allRooms`. Rooms use
   `roomFilterOptions` (features/ui/search-options.ts: once each, in
   room-number order, inactive rooms kept, building as the hint);
   `uniqueById` takes the distinct rows. Done: Results, Proxies, Paper
   ballots and Vote conflicts (meeting and room), Ownership (room and
   owner, `?owner=<id>`, req_0006: `ownerFilterOptions` gives the owners
   in the list with their rooms and email as the hint; placeholder
   `s.common.allOwners`). Still typed text: the proxy holder filter on
   Proxies (name or email) and the Rooms master list itself. e2e tests put ids, not titles or room numbers, in these URLs,
   and check the filter once through the UI with `chooseSearchOption`.

## Backlog
Split on 2026-11-15 (no behaviour change; old import paths still work):
- `action-modules/people.ts` -> `people/` (helpers, rooms, owners,
  ownership, access); `meetings.ts` -> `meetings/` (helpers,
  meeting-actions, question-actions); `voting.ts` -> `voting/` (helpers,
  proxies, manual-votes, conflicts). The old files are re-export barrels.
- `components/ownership-manager.tsx` -> `ownership/` (helpers, drawers,
  row); `components/vote-conflicts-table.tsx` -> `vote-conflicts/`
  (helpers, resolve form).
- `tests/e2e/admin-demo.spec.ts` -> `tests/e2e/admin/`, one spec per flow,
  numbered to keep the old run order.

- `scripts/seed-demo.mjs` -> `scripts/demo-seed/` (context, people,
  meeting-builder, meetings, results, emails). Each file imports the one
  before it, so the steps run in the same order.
- `tests/e2e/admin/01-lifecycle.spec.ts`: still one `@full` test, but its
  steps live in `tests/e2e/admin/lifecycle/`, one file per feature; values
  a later step needs are passed in a typed context object.

Still large, accepted for now:
- `components/ownership-manager.tsx` (about 600 lines): one component;
  splitting further means changing its state handling, not just moving code.
- `lib/supabase/database.types.ts` is generated (`npm run types:supabase`);
  migrations are applied history. Neither is split by hand.

Between 400 and 600 lines (split when next changed): `sections/people/rooms-panel.tsx`,
`sections/people/owners-panel.tsx`, `sections/people/profiles-panel.tsx`,
`sections/meetings/meetings-section.tsx`, `sections/voting/manual-votes-section.tsx`.

## When To Revisit
Consider a separate service only when one of these is true:
- Multi-condo tenancy ([D009](decisions.md#d009---prepare-for-multi-condo-tenancy))
  creates load that one app cannot handle.
- A part needs a different runtime, scaling, or release cycle, for example a
  high-volume email or PDF worker.
- A separate team owns that part.
