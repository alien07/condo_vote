# Help And User Guides: Plan And Outline

User guides for people who use condoVotes, as opposed to the developer
docs in this folder. Agreed plan (2026-11): build the help system and the
owner guide now; write the staff guides after the demo round, when the
admin screens settle.

## Where Guides Live
- In the app at `/help` (public, no sign-in), Thai and English, switched with
  the language buttons. Content: `lib/help/*.ts`, one file per guide.
- The "?" button in the header opens the topic for the current page
  (`helpHrefForPath` in `lib/help/index.ts`).
- Screenshots: `public/help/<lang>/*.png`, made by `npm run help:screenshots`
  from the demo data (`npm run demo:seed -- --reset --consent`). Never edit
  screenshots by hand; re-run the script after UI changes.
- Quick guide PDF: `public/help/<guide>-quick-guide-<lang>.pdf`, made by
  `npm run help:pdf` from `/help/<guide>?print=1`.

## Writing Rules
- Plain Thai first; English says the same thing. Thai prevails.
- Task-based: one step = one screen = one screenshot.
- Use the button and status words exactly as the app shows them.
- Every step must be checkable against `docs/demo-script.md`.
- Update `HELP_CHECKED_FOR` when a release is checked.

## Guides
| # | Guide | Readers | Status |
|---|---|---|---|
| 1 | How to vote online (`/help/owner`) + quick guide PDF + FAQ | Owners, proxies | Done (v0.1) |
| 2 | Juristic office playbook | Admin staff | After demo |
| 3 | Committee guide | Committee | After demo |
| 4 | Setup and go-live guide | System admin / IT | Before production |
| 5 | Incident runbook | IT + admin staff | Before production |

### 2. Juristic office playbook (outline)
Organized by the meeting timeline, with a checklist per stage:
1. Before the first meeting: condo profile, committee members, rooms and
   owners (Excel import), ownership links.
2. T-30 days: create the meeting, agenda items and pass rules, advance window.
3. T-14 days: proxies, publish (voter snapshot), send invitations, resend.
4. Meeting day: monitor voting, paper ballots, incidents.
5. After voting closes: conflicts, pending identities, generate the result.
6. Committee approval, publication, PDF files, the official record.
7. Archive. Common errors and what to do (error codes).

### 3. Committee guide (outline)
1. What to check before approving a result.
2. Approving early close of voting.
3. Multiple approvals (for example 2 of 2) and what happens after the last one.

### 4. Setup and go-live guide (outline)
1. Hosting and database (from `operations.md`).
2. Google sign-in, email sending (SMTP), app URL.
3. PDPA notice, retention, system admin.
4. Condo data, test meeting, go-live checklist.
5. In-app setup checklist on the admin overview (planned).

### 5. Incident runbook (outline)
System down during voting, emails not sending, owner cannot sign in,
recording incidents, backups before and after a meeting.

## Collecting Questions
During the demo, write every question users ask in one feedback list. It is
the source for the FAQ and for guides 2 and 3.
