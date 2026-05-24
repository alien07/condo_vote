# Roadmap

## Phase 0 - Project Foundation
- Create documentation.
- Choose frontend framework.
- Create Supabase project plan.
- Define database schema.
- Define RLS policy strategy.

## Phase 1 - MVP Admin And Voting
- Auth with Google or email magic link.
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
- Private document storage.
- Email invitations.
- Email result notification.
- PDF result export.

## Phase 3 - Hardening
- Full RLS coverage.
- Audit log.
- Import rooms/owners from CSV.
- Better admin dashboard.

## Phase 4 - V2 Voting And Meeting Flexibility
- Committee approval notes include conflict handling remarks when applicable.
- Design for dynamic agenda or vote topics added during a meeting, from 0 to n items.
- Future schema concept: `meeting_question_revisions` or `agenda_change_requests`.
- Runtime-added agenda items require approval and an audit trail before voting.

## Later
- LINE login or LINE notification.
- Multi-condo tenancy.
- Legal-grade signing flow.
- Realtime result/admin dashboard.
