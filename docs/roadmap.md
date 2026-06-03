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
- Mock PDF result summary.
- Mock Thai/English result notification email queue.

## Tail V1 - Production Communication
- Generate juristic-person PDF result summary from approved snapshots.
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
- Translate admin pages after owner-facing Vote and Summary flows are stable.

## Later
- Direct private document upload adapters and Google Drive API synchronization after credential and sharing policy approval.
- LINE login or LINE notification.
- Multi-condo tenancy.
- Legal-grade signing flow.
- Realtime result/admin dashboard.
