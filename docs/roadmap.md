# Roadmap

## Phase 0 - Project Foundation
- Create documentation.
- Choose frontend framework.
- Create Supabase project plan.
- Define database schema.
- Define RLS policy strategy.

## Phase 1 - MVP Admin And Voting
- Auth with Google login and policy-based vote invitation links.
- Admin room and owner CRUD.
- Voter registration and approval.
- Meeting CRUD.
- Question and choice CRUD.
- Publish meeting.
- Voting window enforcement.
- Ballot submit/edit.
- Basic result calculation.
- Committee/admin result approval.

## Phase 2 - Documents And Communication
- Proxy approval documents.
- Private document registry foundation with configurable local-drive or Google Drive references.
- Email invitations.
- Mock PDF result summary (replaced by the result documents, D019).
- Mock Thai/English result notification email queue.

## Tail V1 - Production Communication
- Done (D019): official result record and owner summary from the approved
  snapshot, printable from the browser, with SHA-256 and a verify page.
- Done (D021): master PDF files generated once when results are published,
  kept in Supabase Storage and downloadable. Next: attach them to result
  emails once sending is built; Google Drive backup later.
- Done (D020): owner language (`th`/`en`, Thai default) for owner-facing
  pages, email language, and the owner summary; admin pages stay English.
- Send Thai/English result notification emails together.
- Apply provider send limits with queued delivery ordering.
- Attach PDF or provide a signed PDF download link.
- Start Thai-first owner-facing UI copy for Home, Login, Vote, Summary, email,
  and mock PDF preview where practical.

## Phase 3 - Hardening
- Full RLS coverage.
- Business audit log foundation.
- Import rooms, owners, and room-owner links from locked Excel templates.
- Better admin dashboard.

## Phase 4 - V2 Voting And Meeting Flexibility
- Committee approval notes include conflict handling remarks when applicable.
- Design for dynamic agenda or vote topics added during a meeting, from 0 to n items.
- Future schema concept: `meeting_question_revisions` or `agenda_change_requests`.
- Runtime-added agenda items require approval and an audit trail before voting.
- Full bilingual web app support with Thai as the default language and English
  as an alternate language.
- Add a language switcher, dictionary files, locale-aware date/number
  formatting, and admin-configurable default language.
- Done (D020): admin, committee, and system pages in Thai and English,
  including action messages. Admin dates still use the English date format.
- Admin-editable email templates (Thai and English).
- Split remaining oversized files by domain sub-feature (see code-organization.md backlog).
- Postpone or cancel a published meeting (user decision 2026-11-15: V2).
  Today a published meeting cannot change its times or agenda; the only
  option is the committee closing voting early. Proposed flow:
  - Postpone: a manager proposes new advance and meeting-day times with a
    reason; the committee approves with the meeting's minimum; on approval
    the times change, every room gets a new invitation, and it is audited.
    Only before meeting-day voting starts, and the new day must leave the
    notice period (setting, default 7 days; to be confirmed by a lawyer).
    Agenda and choices cannot change. Open question: keep advance ballots
    (proposed, the agenda is the same) or clear them.
  - Cancel: a manager proposes with a reason; the committee approves; the
    meeting gets a new "cancelled" status, voting stops, nothing is counted
    and no result is made; every room is told. Cast ballots are kept for
    audit, secret ballots stay secret. Allowed until a result is generated
    (after that, use a high-level correction). "Copy as a new draft" to
    hold the meeting again.
- Dark mode (UI review 2026-11-15; decide whether to do it in V2). Pages
  use about 250 fixed Tailwind colors (amber, red, green and so on) that
  would need theme tokens first. Print and PDF output must stay light.
  Admin pages wait for the admin review.
- Role management page `/admin/roles` (D023, user decision 2026-11-15).
  Tabs: Roles (create, copy, permission table by menu with a "this role
  sees these menus" preview), People and roles (assign with start/end date
  and reason, several people at once), Check (who can do X, change history).
  Build in three steps so behaviour never changes by surprise:
  - V2-a: permission list, `has_permission(permission, project)`, built-in
    roles with today's access, replace the 134 `has_app_role` checks (about
    21 migrations); existing pgTAP and e2e must pass unchanged.
  - V2-b: People and roles tab and Check tab, using the built-in roles;
    committee term dates required.
  - V2-c: custom roles, the permission table, and warnings for permissions
    that should not go together.
- One owner, several rooms: vote once for all (user request 2026-11-19).
  Today an owner of several rooms votes room by room. Proposed: on the vote
  page the owner picks either room by room (as today) or "all my rooms",
  fills one ballot, and the same answers are saved for every room they can
  vote for in that meeting. Free-text answers (meeting comments) are not
  copied: each room keeps its own. To decide: rooms already voted (skip,
  or overwrite with a confirmation); rooms held as a proxy (include or
  only own rooms); one ballot row per room stays (D011 one voting right per
  room, results and audit unchanged).

## Later
- Direct private document upload adapters and Google Drive API synchronization after credential and sharing policy approval.
- LINE login or LINE notification.
- Multi-condo tenancy (D009).
- Legal-grade signing flow.
- Realtime result/admin dashboard.
