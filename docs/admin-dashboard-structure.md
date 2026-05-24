# Admin Dashboard Structure

The admin area uses a shared layout plus route-level pages by workflow.

## Routes
- `/admin`: overview dashboard and shortcuts.
- `/admin/setup`: juristic profile and committee members.
- `/admin/people`: rooms, owners, registered profiles, and app roles.
- `/admin/ownership`: room-owner relationship management.
- `/admin/meetings`: meetings, agenda questions, choices, publish/archive, and result generation action.
- `/admin/voting`: manual ballots and manual/online conflict resolution.
- `/admin/results`: result snapshots, committee approval, and locked result state.
- `/admin/proxies`: proxy authorization create/review flow.
- `/admin/communications`: mock email queue and delivery logs.

## Components
- `app/admin/layout.tsx` owns the admin navigation shell.
- `features/admin/components/admin-workspace.tsx` contains the migrated server-rendered admin sections.

The current split keeps server actions and data loading in `features/admin/actions.ts` and `features/admin/data.ts` to reduce routing risk. Once route behavior is stable, the next refactor can split those files by domain:
- setup
- people
- ownership
- meetings
- voting
- results
- proxies
- communications
