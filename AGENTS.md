# AGENTS.md

Project: condoVotes - online condominium meeting survey/voting system.

## Working Rules
- No guessing. If a requirement, schema, or legal rule is unclear, document the assumption or ask before implementing.
- Protect sensitive data. Do not commit secrets, real resident data, private keys, production tokens, or personal documents.
- Prefer free/open tooling first, but propose a better paid option when it materially reduces risk or effort.
- Keep this file compact. Put long-lived details in `docs/` and link them here.

## Product Summary
condoVotes lets condominium admins create online meetings, questions, and choices. Eligible owners or approved proxies vote during an open voting window. Results are weighted by room ownership percentage and become visible only after committee approval.

## Core Docs
- Requirements: [docs/requirements.md](docs/requirements.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Admin workflows: [docs/admin-workflows.md](docs/admin-workflows.md)
- Communication: [docs/communication.md](docs/communication.md)
- Data model: [docs/data-model.md](docs/data-model.md)
- Local development: [docs/local-development.md](docs/local-development.md)
- SQL draft: [docs/schema-draft.sql](docs/schema-draft.sql)
- Security and privacy: [docs/security-privacy.md](docs/security-privacy.md)
- Testing: [docs/testing.md](docs/testing.md)
- Roadmap: [docs/roadmap.md](docs/roadmap.md)
- Decisions: [docs/decisions.md](docs/decisions.md)

## Current Implementation Direction
- Frontend: React or Next.js.
- Backend: Supabase Auth, PostgreSQL, RLS, Storage, Edge Functions.
- Auth MVP: Google login or email magic link.
- Video MVP: store an external video URL, not uploaded video files.

## Voting Rules
- Owner can vote.
- Resident cannot vote unless approved as proxy.
- One room equals one voting right.
- Latest ballot version before voting close is the effective vote.
- Results support two denominators: total project ownership and submitted-vote ownership.
- Public result visibility requires committee approval.

## Data Handling
- Use synthetic seed data only.
- Mask or omit personal data in logs, screenshots, docs, and test fixtures.
- Keep uploaded approval/proxy documents private by default.
