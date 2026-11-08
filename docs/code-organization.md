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

## Backlog
These files are over the limit and should be split by sub-feature
(roadmap Phase 4):
- `features/admin/action-modules/people.ts` (about 1,340 lines)
- `features/admin/components/ownership-manager.tsx` (about 1,110 lines)
- `features/admin/action-modules/voting.ts` (about 925 lines)
- `features/admin/action-modules/meetings.ts` (about 730 lines)
- `features/admin/components/vote-conflicts-table.tsx` (about 710 lines)
- `tests/e2e/admin-demo.spec.ts` (about 3,450 lines): split by admin flow

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
