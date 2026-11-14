# Help And User Guides: Plan And Outline

User guides for people who use condoVotes, as opposed to the developer
docs in this folder. Agreed plan (2026-11): one guide per group of
readers, using the roles from D022 (demo feedback item 14). The owner and
committee guides are published; the office staff guide waits until the
admin screens have been reviewed (user decision, 2026-11-14).

## Where Guides Live
- In the app at `/help`, Thai and English, switched with the language
  buttons. Content: `lib/help/*.ts`, one file per guide.
- Each reader sees the guides for their roles (`GUIDES` in
  `lib/help/index.ts`): the owner guide for everyone, signed in or not; the
  committee guide for committee members, admins and auditors. A guide for
  other roles sends the reader back to `/help`. The quick guide PDFs are
  static files in `public/help`, so anyone with the exact link can download
  them; they hold no personal data.
- The "?" button in the header opens the topic for the current page
  (`helpHrefForPath` in `lib/help/index.ts`).
- Screenshots: `public/help/<lang>/*.png`, made by `npm run help:screenshots`
  from the demo data (`npm run demo:seed -- --reset --consent`). Never edit
  screenshots by hand; re-run the script after UI changes.
- Quick guide PDF: `public/help/<guide>-quick-guide-<lang>.pdf`, made by
  `npm run help:pdf` from `/help/<guide>?print=1`. Quick guides are for the
  owner and committee guides, which are handed out; the staff, setup and
  incident guides are read in the app or as full documents.
- A signed-in person's saved language wins over the `lang` cookie (D020), so
  the screenshot script switches the demo personas' language while it runs
  and puts it back afterwards.

## Writing Rules
- Plain Thai first; English says the same thing. Thai prevails.
- Task-based: one step = one screen = one screenshot.
- Use the button and status words exactly as the app shows them.
- Every step must be checkable against `docs/demo-script.md`.
- Update `HELP_CHECKED_FOR` when a release is checked.

## Guides
| # | Guide | Readers (roles, D022) | Status |
|---|---|---|---|
| 1 | How to vote online (`/help/owner`) + quick guide PDF + FAQ | Room owners, co-owners given the vote, external proxy holders; residents (results only); new and rejected accounts (FAQ) | Done (updated 2026-11-14) |
| 2 | Juristic office playbook | Office staff and managers (admin), one guide, each step says whose job it is | Waiting: admin screens not fully reviewed yet |
| 3 | Committee guide (`/help/committee`) + quick guide PDF, with a page for auditors | Committee, auditors | Done (2026-11-14) |
| 4 | Setup and go-live guide | System admin / IT | Before production |
| 5 | Incident runbook | IT + office staff | Before production |

Roles without a guide of their own: residents and new or rejected accounts
are covered in guide 1; auditors have the last page of guide 3.

### 2. Juristic office playbook (outline)
Organized by the meeting timeline, with a checklist per stage. Mark each
step "Staff" (data entry: rooms, owners, Excel import, paper ballots) or
"Manager" (publish a meeting, generate results, answer correction requests,
invite the committee).
1. Before the first meeting: condo profile, committee members, rooms and
   owners (Excel import), ownership links.
2. T-30 days: create the meeting, agenda items and pass rules, advance window.
3. T-14 days: proxies, publish (voter snapshot), send invitations, resend.
4. Meeting day: monitor voting, paper ballots, incidents.
5. After voting closes: conflicts, pending identities, generate the result.
6. Committee approval, publication, PDF files, the official record.
7. Archive. Common errors and what to do (error codes).

### 3. Committee guide (as published)
1. The Committee page and its two parts.
2. Proposing to close voting early (reason, when to close).
3. Answering a close-early request: approve or object with a reason; when
   it fails; changing an answer; cancel and lapse.
4. What to check before approving a result; approval means the numbers are
   correct.
5. Approving; separation of duties.
6. Requesting a correction; levels (low, medium, high; "Other" starts at
   medium; the admin can only raise it).
7. Approving again after a correction.
8. For auditors: the read-only Audit page.

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
