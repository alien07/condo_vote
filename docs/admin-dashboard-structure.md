# Admin Dashboard Structure

The admin area uses a shared layout plus route-level pages by workflow.

## Routes
- `/admin`: overview dashboard and shortcuts.
- `/admin/setup`: juristic profile, private document registry, committee members, and business audit log.
- `/admin/people`: rooms, owners, registered profiles, and app roles.
- `/admin/ownership`: room-owner relationship management.
- `/admin/meetings`: meetings, agenda questions, choices, publish/archive, and result generation action.
- `/admin/voting`: manual ballots and manual/online conflict resolution.
- `/admin/results`: result snapshots, committee approval, and locked result state.
- `/admin/proxies`: proxy authorization create/review flow.
- `/admin/communications`: mock email queue and delivery logs.

## Components And Server Modules
- `app/admin/layout.tsx` owns the admin navigation shell.
- `features/admin/components/admin-workspace.tsx` loads dashboard data, derives
  cross-domain state, and renders one section component per tab.
- Section components live in `features/admin/components/sections/<domain>/`.
  Each section computes its own filter, sort, and paging state.
- `features/admin/actions.ts` remains the stable import entrypoint and re-exports domain server actions from `features/admin/action-modules/`.
- `features/admin/data.ts` remains the dashboard aggregator and loads domain data from `features/admin/data-modules/`.

Section components by domain:
- setup: `juristic-profile-section`, `document-storage-section`, `audit-log-section`, `committee-section`
- people: `people-crud-pilot` with `rooms-panel`, `owners-panel`, `profiles-panel`, their forms, and `ownership-section`
- meetings: `meetings-section`, `questions-section`
- voting: `manual-votes-section`
- results: `results-section`, `result-pdf-preview`
- communications: `email-section`
- proxies: `proxies-section`

Domain module split:
- setup
- people
- meetings
- voting
- results
- communications
- documents

Code organization rules: [code-organization.md](code-organization.md).
