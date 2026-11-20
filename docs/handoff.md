# Handoff: chat → Claude Code cloud session (environment "Condo")

How it works (user decision 2026-11-19): every task has a number `req_####` from `claude/requirements.md`. The chat only collects requirements and hands them off; Claude Code does the work; the chat checks the result again.

1. The chat writes the task here under `## req_####` (what, where, acceptance criteria) and pushes this file to `dev`. **The user starts Claude Code themselves** (user decision 2026-11-20), naming the req number, e.g. "do req_0006 from docs/handoff.md".
2. Claude Code: branch `<type>/req-####-<topic>` from `dev`; PR title starts with `[req_####]`; commits carry a `Req: req_####` line. Run npm ci, lint, typecheck, test:unit, build, test:db when the database changes, the related e2e specs, then the full CI run (`ci.yml` workflow_dispatch `full=true`). Squash merge when everything is green. Then fill the req's **Result** below (PR number, what changed, checks run, anything left) and set its status in `claude/requirements.md` to `done (PR #N)`.
3. The chat checks the PR and CI, pulls `dev` onto the Windows machine with migrations, renders the pages at 1440/768/375, compares with the acceptance criteria, and sets the status to `verified` or opens a follow-up req.

---

## req_0001: documents page review fixes (status: done, PR #65 + #66; the chat still has to check it)
Started before req numbers existed: it is being done by the Claude Code agent the chat started in the background, on branch `fix/documents-page` (not pushed yet). Brief: `claude/todo-admin-documents.md`.

### Result
(Claude Code writes here: PR number, what changed, checks run, anything left)

Note from the req_0002/req_0004 session (2026-11-19): **PR #66** (https://github.com/alien07/condo_vote/pull/66) fixed the e2e that #65 left red on `dev` (CI run 44529829750: `01-lifecycle` timed out, `03-committee-documents` failed). Cause: the Register document `<label>` now wraps its field with the help line or the options, so `getByLabel(..., { exact: true })` matched nothing; the tests now look the fields up without `exact`. Test-only; full CI run 44583806726 green (46 passed, 9 skipped).

---

## req_0002: audit log details still show raw values (status: done, PR #67)
Branch `fix/req-0002-audit-values`. Page `/admin/setup?tab=audit`; helper `features/admin/components/sections/setup/audit-log-labels.ts` (`valueText`, `auditDetailPairs`), words in `lib/i18n/staff/audit-log.ts` (`values`, `fields`).

Problem (found when checking #63): some detail values are still stored codes, e.g. a correction level change shows "เป็น: high / จาก: low". Free text that people typed (e.g. an answer "ok") stays as typed.

Do:
- Translate the correction levels `low` / `medium` / `high` (reuse the committee words: ต่ำ / กลาง / สูง, Low / Medium / High) in the audit details.
- Scan the local demo database (`audit_logs.details`) and the code that writes audit details (`writeAuditLog` calls and SQL functions that insert into `audit_logs`) for every other string value that is a stored code (status, type, source, role, level, provider …) and add the missing ones to `values` in Thai and English. Prefer reusing existing code words (`s.common.code` / `codeLabel`) over duplicating them.
- Unit tests in `audit-log-labels.test.ts` for the new values.

Acceptance: no audit detail on `/admin/setup?tab=audit` (demo data) shows a lowercase code value in Thai or English; typed text is unchanged; "Raw data" still shows the stored JSON.

### Result
**PR #67** (https://github.com/alien07/condo_vote/pull/67), branch `fix/req-0002-audit-values`, merged into `dev` by alien07 on 2026-11-19 18:34 UTC (merge commit 0b3d604). Full CI run (`full=true`) 44585891574 green; the pull_request run 44585857323 failed only in "Demo seed check" (dev server timed out at "Compiling / ..." before any test) and was re-run.

What changed:
- `features/admin/components/sections/setup/audit-log-labels.ts`: only fields that hold codes are translated (`CODE_FIELDS`: status, level, from, to, category, source, chosen_source, approval_status, default_status, previous_*, granted_role, preferred_language, document_type, storage providers, meeting_round; `answer` only for approve / object). Typed text (reason, correction answer, names) stays as typed. Lookup: field-specific words → committee categories / levels → `auditLog.values` → `common.code`.
- `lib/i18n/staff/audit-log.ts`: English words for the shared codes (`sharedCodeWords`; Thai takes the same keys from `common.code`), `th` / `en` / `other`, `fieldValues.source` (sign_in, owner_email, admin, migration_0037), field label `preferred_language`.
- Codes found from: distinct values in the demo database's `audit_logs.details_json`, every `writeAuditLog` call, every SQL function inserting into `audit_logs`, and the check constraints of those columns.
- Tests: `audit-log-labels.test.ts` (every code of every code field shows words in TH and EN; levels; `source` vs `granted_role`; typed text; unknown code); e2e `09-communications-setup` checks "From: Low", "To: High" and a typed reason.
- Checks: npm ci, lint, typecheck, test:unit (111), build; demo database 31 audit rows → no code-like value in TH or EN; browser check of `/admin/setup?tab=audit` in TH and EN; e2e 09, table-search, language.

Left over: none for this req. A new code value written in future needs its words in `audit-log.ts`; the unit test lists the codes per field, so add new ones there too.

---

## req_0003: hydration mismatch warnings on admin pages (status: on hold)
Branch `fix/req-0003-hydration`.

**On hold (2026-11-20):** the first scheduled run stopped at the usage limit before doing anything, and the user did not resend it. The chat checked `dev` 84d8fd3 on Windows: `/admin`, `/admin/results`, `/admin/setup`, `/admin/setup?tab=audit`, `/admin/documents`, `/admin/people` logged no hydration warning. Do not start it unless the warning comes back; then add the full console message here.

Problem (found when checking #63/#64, dev server on Windows): the browser console shows "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up." on nearly every admin page: `/admin/setup` (all tabs), `/admin/results`, and others. The pages look right, but React keeps the server attributes, so something may be wrong after hydration.

Do:
- Reproduce with Playwright on the dev server (`npm run dev`), signed in through `/auth/local-demo?as=admin`, capturing the full console message (React prints the differing attribute and component in the diff). Check `/admin`, `/admin/setup`, `/admin/results`, `/admin/meetings`, `/admin/voting`, `/admin/communications`, `/admin/documents`, `/committee`, `/vote`.
- Find the cause (typical: `Date.now()`/`new Date()` or locale/time-zone formatting during render, `Math.random()`/generated ids, `typeof window` branches, browser-only state such as localStorage used in the first render, or `useSyncExternalStore` with different server/client snapshots). Fix it at the source; do not add `suppressHydrationWarning` except for a value that must differ (e.g. a live clock), and explain any such case.
- Add an e2e check (e.g. in `tests/e2e/app-shell.spec.ts` or a new spec) that fails when a hydration warning is logged on the main admin pages.

Acceptance: no hydration warning in the console on the pages above, at 1440 and 375 px.

### Result
(Claude Code writes here)

---

## req_0004: accounts waiting for approval are hard to find (status: done, PR #68 + #69)
Branch `feat/req-0004-pending-accounts`. User decision 2026-11-15, recorded in `claude/demo-feedback.md` ("To do when reviewing the admin pages").

Problem: the admin overview (`app/admin/page.tsx`, `MetricCard` list) has no card for accounts waiting for approval, and the Users tab of Rooms & Owners (`/admin/people?tab=users`, `features/admin/components/sections/people/profiles-panel.tsx`) filters only by name and default status, not by approval status.

Do:
- Overview: a card "บัญชีรออนุมัติ" / "Accounts waiting for approval" with the count (profiles with `approval_status = 'pending'`), status "ต้องตรวจ" when > 0 and "เรียบร้อย" when 0, like the pending proxies card, linking straight to the Users tab filtered to pending. Only for roles that may approve accounts (check `lib/auth/permissions` and the staff nav rules in `app/admin/layout.tsx`).
- Users tab: an "สถานะการอนุมัติ" / "Approval status" filter (all / pending / approved / rejected …, the values the column really has), kept in the URL (e.g. `?approval=pending`) like the other filters; approval status shown as a colour badge in the list (and phone cards if the list has them).
- i18n TH/EN, unit test for any helper, e2e: the card shows the pending count and its link opens the Users tab with only pending accounts.

Acceptance: from `/admin`, one click reaches the list of only the accounts waiting for approval; the filter works on its own from the Users tab and survives paging.

### Result
**PR #68** (https://github.com/alien07/condo_vote/pull/68), branch `feat/req-0004-pending-accounts`, merged into `dev` by alien07 on 2026-11-19 18:28 UTC (merge commit db998d7) while its full CI run 44585897872 was red: `01-lifecycle` still read the code `approved` in the Users tab, which is now the word badge "Approved". The test fix came a few minutes after the merge, so it went in as **PR #69** (https://github.com/alien07/condo_vote/pull/69), test-only.

What changed:
- Overview (`app/admin/page.tsx`): card "บัญชีรออนุมัติ" / "Accounts waiting for approval" in Master data, count of `approval_status = 'pending'`, "ต้องตรวจ" / "Needs review" (warning) when > 0, "เรียบร้อย" / "All clear" when 0; link `/admin/people?tab=profiles&approval=pending` (`PENDING_ACCOUNTS_HREF`). Shown only to the admin role (only admins may approve accounts: `updateProfileAccess` → `requireAdmin`); office staff see the overview without it.
- The Users tab key is `tab=profiles` (the brief said `tab=users`).
- Users tab (`profiles-panel.tsx`): "สถานะการอนุมัติ" / "Approval status" filter (all / pending / approved / rejected), kept in the URL as `?approval=` (`people-table-state.ts`), filter chip, Clear; approval status as a colour badge (pending amber, approved green, rejected red). The list has no phone cards.
- Tests: `people-table-state.test.ts`; e2e `06-people` (card count and status, one click to pending only, filter survives Per page 10 → page 2, filter on its own from the Users tab); `lifecycle/access.ts` reads the badge word.
- Checks: npm ci, lint, typecheck, test:unit, build; local e2e 06 and 01-lifecycle on a fresh database (3/3).

Left over: the chat's check at 1440/768/375 (handoff step 3). Office staff do not see the card; if they should see the count without approving, that is a new req.

---

## req_0006: owner filter on the ownership page is not a SearchSelect (status: done, PR #71)
Branch `fix/req-0006-ownership-owner-filter`. Found by the user 2026-11-20.

Problem: on `/admin/ownership` (`features/admin/components/ownership-manager.tsx`, filter panel around line 279) the "เจ้าของ" / "Owner" filter is a typed text box. The rule in `docs/code-organization.md` rule 8 says choices that are database rows use `SearchSelect` and submit the row's id. The SearchSelect rollout (#61) left this one as typed text on purpose; the user now wants it changed. (The owner field in the add form is already a SearchSelect.)

Do:
- Replace the owner text box with a `SearchSelect` of owners, submitting the owner's id, kept in the URL as `?owner=<id>` like the room filter (`?room=<id>`). Options: only owners that appear in this list (`uniqueById` / a builder in `features/ui/search-options.ts`, like `roomFilterOptions`), label = owner name, hint = their rooms and email (reuse the hint shape of `ownerOptions` in the same file). Clearing the field removes the filter.
- Filter the list by owner id instead of a name substring. Keep sort by owner name working.
- i18n TH/EN: reuse `common` "all" wording (e.g. add `common.allOwners` / "เจ้าของทั้งหมด" if missing); remove keys that become unused.
- Update `docs/code-organization.md` rule 8 (remove the "owner filter stays typed text" exception, if listed) and e2e that put a name in `?owner=` (`tests/e2e/admin/04-proxies-ownership.spec.ts` ownership test and any lifecycle step); add one UI check that picks an owner with `chooseSearchOption` and sees only that owner's rows. Unit test for any new option builder.

Acceptance: on `/admin/ownership` the owner filter is a searchable picker of the owners in the list; choosing one shows only that owner's rooms and puts `?owner=<id>` in the URL; the filter survives paging and Clear resets it; works at 1440, 768 and 375 px.

### Result
**PR #71** (https://github.com/alien07/condo_vote/pull/71), branch `fix/req-0006-ownership-owner-filter`, merged by alien07 on 2026-11-19 19:29 UTC; full CI run 44596975866 green.

What changed:
- `/admin/ownership`: the Owner filter is a `SearchSelect` of the owners in the list (`ownerFilterOptions` in `features/ui/search-options.ts`: once each, by name; hint = their rooms in the list and their email, both searchable), submitting the owner id as `?owner=<id>`. The list compares the owner id; sort by owner name unchanged; Clear removes it; it survives paging.
- i18n: `common.allOwners` (moved from `documents.allOwners`; the documents owner filter uses it too); removed `ownership.searchOwner`.
- `docs/code-organization.md` rule 8: Ownership owner filter done; typed-text exceptions are now the proxy holder filter and the Rooms list.
- Tests: `ownerFilterOptions` unit tests; e2e 04 picks the owner with `chooseSearchOption`, sees only that owner's row and `?owner=<id>`, keeps it through Per page, loses it with Clear; the lifecycle no longer puts a name in `?owner=`.
- Checks: npm ci, lint, typecheck, test:unit (116), build; e2e 01, 03, 04 on a fresh database; 1440 / 768 / 375 px no horizontal scroll.

Left over: an old URL with a name in `?owner=` now matches nothing.

---

## req_0007: audit page `/audit`: easy to read and quick to search (status: done, PR #72)
Branch `feat/req-0007-audit-page`. UI review by the chat 2026-11-20 at 1440/768/375 (signed in as demo admin; there is no auditor demo persona). The user approved every item.

The page (`app/audit/page.tsx`, read-only, for auditors / committee / admin) is for finding evidence about one meeting fast: who approved, who asked for a correction, what changed, when. Today it is one page about 6,000 px long with three stacked sections and no search.

Must fix
1. **No search, filters or paging.** Published results (~30 rows), correction requests (`.limit(50)`) and the audit log (`.limit(100)`, latest only) are stacked with nothing to search by; anything older than the limits cannot be found at all. → Split into tabs "ผลที่ประกาศแล้ว / คำขอแก้ไขผล / บันทึกการใช้งาน" ("Published results / Correction requests / Activity log") with a count on each, in the URL (`?tab=`), like the setup page tabs. Each tab gets the standard filter panel and pagination (server-side, no fixed limit). Add one meeting picker (SearchSelect by id, `?meeting=<id>`, rule 8) above the tabs that filters all three tabs at once; plus date range on each tab, and actor + action filters on the activity log.
2. **The activity log shows raw codes** (`result.correction_answered`, `manual_ballot.identity_resolved`, entity `result_correction_request`, …) although `/admin/setup?tab=audit` already shows them in words (#63, #67). → Reuse the same audit log table and helpers (`features/admin/components/audit-log-table.tsx`, `features/admin/components/sections/setup/audit-log-labels.ts`, `audit-log-rows.tsx`, `audit-log-action-filter.tsx`): words, readable details with "Raw data" folded (keep it, user decision 2026-11-20), grouped action filter, phone cards. Check that an auditor (role `auditor`, not admin) can read the same data under RLS and that the shared component does not need admin-only data.

Should fix
3. The published results list shows "date · 1": the number is `approvals_count` with no word. → "อนุมัติ 1 คน" / "Approved by 1".
4. The page description promises official documents, but rows only link "ดูบันทึกผล (หน้าเว็บ)". → Add "ดาวน์โหลด PDF ฉบับทางการ" / "Download official PDF" when the result has its official PDF (`result_documents` kind `official`, same rule as `features/admin/components/sections/results/result-row-actions.tsx`). Keep `?from=audit` on the record link (#64).
5. Small targets: "ดูบันทึกผล (หน้าเว็บ)" is a 20px-high text link → buttons at least 40px high (or the whole row clickable), as on the results page.
6. Correction request cards: one long dot-separated line (date · category · level · status) and a tiny "เหตุผล" label → level and status as colour badges (same colours as the committee page), category as text, reason with a readable label; meeting name first.

Nice to have
7. Test data from e2e runs ("Result rollout 17950…", `e2e.audit.pagination…`) makes the page look messy; with item 1 it is filterable. No data clean-up in this PR.

Acceptance: on `/audit`, picking a meeting shows only that meeting's results, correction requests and log entries; each tab pages through everything (no 50/100 cap); the activity log reads in words in Thai and English; published rows say "อนุมัติ n คน" and offer the official PDF when it exists; every button is at least 40px high; no horizontal scroll or raw codes at 1440, 768 and 375 px. e2e: tab switch, meeting filter by id, paging past the old limits, log in words; check as an auditor if a fixture exists (add one if needed).

### Result
**PR #72** (https://github.com/alien07/condo_vote/pull/72), branch `feat/req-0007-audit-page`, squash merged 2026-11-19 19:44 UTC after both CI runs were green (PR run 44599086713, full run 44599081267).

What changed:
- One meeting picker (`SearchSelect` by id, `?meeting=<id>`) above tabs "ผลที่ประกาศแล้ว / คำขอแก้ไขผล / บันทึกการใช้งาน" (`?tab=`) with counts; each tab has a filter panel (dates; the log also actor and grouped actions) and server-side paging through every row (no 50/100 cap).
- Log tab = the Setup audit log table (words, readable details, "Raw data" folded, phone cards) through a new `/api/audit/logs` (`requireAuditReader`: auditor or admin). `AuditLogTable` takes `endpoint` and `baseParams`. `fetchAuditLogRows` filters by meeting (`auditMeetingFilter`: the meeting, details `meeting_id` / `meeting`, and its results, correction and close requests and proxies).
- RLS: an auditor reads audit_logs, meetings, profiles, correction / close requests, result_documents and published results, but not proxy_authorizations or documents. New proxy audit rows now carry `meeting_id` so they are found by meeting for auditors too (older proxy rows only for an admin).
- Published rows "อนุมัติ n คน", "ดาวน์โหลด PDF ฉบับทางการ" when the official PDF exists, record link keeps `?from=audit`; buttons ≥ 40 px; correction cards with level / status colour badges (level low grey / medium amber / high red; status open amber / fixed green / no change grey), category in words, who asked and when, reason and answer with readable labels.
- Tests: `features/audit/data.test.ts`; e2e `tests/e2e/audit-page.spec.ts` as a synthetic **auditor** (meeting filter by id, tab switch, paging 101-120 of 120, log in words, buttons ≥ 40 px, no horizontal scroll at 1440 / 768 / 375); 08, 09, table-search, role-access passed. The spec selector runs it for audit and admin changes.

Left over: access stays auditor or admin (the brief mentions committee; the page never allowed committee-only users). Test data from e2e still shows on the page (now filterable).

---

## req_0008: admin overview `/admin`: what to do now, and fit to show in a meeting (status: done, PR #73)
Branch `feat/req-0008-admin-overview`. UI review by the chat 2026-11-20 at 1440/768/375 (dev 84d8fd3), lens "daily use + presenting". The user approved every item. Main file `app/admin/page.tsx` (MetricCard list, groups master / readiness / attention / results, links grid), `features/english/missing-english-panel.tsx`, words in `lib/i18n/staff/admin-home.ts`.

The page is the admin's first stop: it should say what is waiting for them now, and when shown on a screen in a meeting, the state of the live meeting at a glance. Today it lists all-time totals and puts the work waiting far down the page.

Must fix
1. **Priorities upside down.** "ต้องดำเนินการ" (attention) starts about 1,350 px down on desktop and 2,400 px on a phone; the top is the missing-English box and master data that is mostly at 100%. → New order: attention → meetings happening now (item 2) → readiness → master data. Cards with nothing waiting become compact (one line) so the page gets shorter.
2. **No spotlight on the meeting happening now.** → At the top, one large card per meeting that is open for voting or opens within the next 7 days (published, not closed): title, open/close time and time left (or "opens in …"), turnout so far as rooms voted / eligible and ownership voted / total, and whether the quorum rule of that meeting is met yet (reuse the quorum logic already used for results, e.g. `features/results` / meeting readiness helpers; do not duplicate the rule), with a progress bar and a button to the meeting. **Never show votes per choice or any result before committee approval** (secret ballot D015, results only after approval): turnout and quorum only. If none, one quiet line "ไม่มีการประชุมที่เปิดลงคะแนน" with the next draft meeting if any. Keep counts correct for the admin role and RLS; reuse existing data modules where possible.
3. **The missing-English box (153) is almost all meetings that cannot be fixed**: every listed one is already published, and editing text after publishing is a V2 item. → Count and list only meetings whose English can still be filled in (drafts; check `features/english` for the exact rule), and show it as one card in "ต้องดำเนินการ" linking to the list, instead of a big yellow box on top. Hide it when bilingual documents are off or the count is 0.

Should fix
4. **Not clear which cards are clickable**: some cards have a 16px footer text link ("ดูผู้ใช้", "จัดการการประชุม"), some none. → The whole card is the link (min 44px target, hover/focus state, "→"), and cards without a destination look plainly informational.
5. **Colour meanings mixed**: amber marks both "needs action" (pending accounts, proxy requests) and readiness percentages (room links 16%, approvals 52%, eligible voters 73%). → Amber only for "something is waiting for you"; readiness uses the progress bar on a white card; green only for complete.
6. **Some numbers do not say what to do**: "การอนุมัติ 33 / 64 · กรรมการอนุมัติแล้ว 33 ครั้ง", "บัตรกระดาษ 39 · 11% ของผู้มีสิทธิ์", "การประชุม 166", "วาระ 145", "ผลการลงมติ 64". → Replace all-time totals with actionable states, e.g. "ผลรออนุมัติ n ชุด", "บัตรกระดาษรอผูกผู้ใช้ n ใบ", "ห้องที่ลงสองช่องทาง n", "การประชุมร่าง n · เปิดลงคะแนน n"; each links to the filtered list where one exists.
7. **The "งานของผู้ดูแล" links grid repeats the top menu** (8 links) → remove it.
8. **Stacked headings**: page title "ผู้ดูแลระบบ" does not match the menu "ภาพรวม", and "ภาพรวมการทำงาน" sits above the group headings → title "ภาพรวม" / "Overview", drop the extra heading.

Nice to have
9. Phones: the page is 4,589 px with every card full width → small metric cards two per row on phones; the meeting spotlight stays full width.
10. "อีเมลในคิว 492" is always amber because emails are only queued (not sent yet, see `/admin/communications`) → neutral card with the same "not sent yet" wording as the communications page, not a warning.

Acceptance: at 1440 / 768 / 375 px the first screen shows what is waiting (or that nothing is) and the meeting happening now with turnout and quorum (no per-choice votes); every card is either a clear link or plainly informational; amber only means waiting work; no links grid; title "ภาพรวม"; the missing-English card counts only meetings that can still be fixed; no horizontal scroll. TH/EN. Unit tests for new helpers (spotlight selection, actionable counts); e2e in the admin overview spec for the attention order, the spotlight (a published open meeting in demo data) and that no per-choice result appears before approval.

### Result
**PR #73** (https://github.com/alien07/condo_vote/pull/73), branch `feat/req-0008-admin-overview`, squash merged 2026-11-20 06:18 UTC after both CI runs were green on the updated branch (PR run 44685455156, full run 44685447686). An earlier PR run failed in "Demo seed check" only (dev server compile timeout, no test failed); fixed for every PR by **PR #74** (`rm -rf .next/dev` before that step: the second `next dev` restored the large Turbopack cache the e2e suite left).

What changed:
- Order: Waiting for you → Meetings now → Readiness → Master data. Waiting cards amber only when something waits; with nothing waiting they are one line ("All clear"); "ไม่มีงานรอดำเนินการ" when all clear.
- Meetings now: a large card per meeting open for voting or opening within 7 days: window, time left / opens in, rooms voted / eligible, ownership voted / total with bars, quorum met or not (`evaluateQuorum`, same rule as the result). No answers are read; never votes per choice (D015). None open: one line plus the next draft.
- Waiting work as counts linking to filtered lists: accounts waiting, proxy requests, results waiting for approval (per meeting), paper ballots to link, rooms that voted twice (unresolved), draft meetings missing English.
- Whole card is the link (≥ 44 px, hover, focus, "→"); readiness with a progress bar on white; green only when complete; "อีเมลในคิว" neutral with the "not sent yet" wording and a real count.
- Title "ภาพรวม" / "Overview", no extra heading, no links grid; small cards two per row on phones.
- Code: `features/admin/overview/` (model with unit tests, data paged past 1000 rows, card and spotlight components); removed `missing-english-panel.tsx`.
- Tests: `overview-model.test.ts`; e2e `tests/e2e/admin/11-overview.spec.ts` (group order, spotlight turnout and quorum, the voted choice never shown, no links grid, amber only for waiting, 44 px cards, no horizontal scroll at 1440 / 768 / 375); lifecycle, role-access, language updated.

Left over:
- **English card counts drafts only**, as the brief asks, although the code still allows editing English after publishing (D020 / 0039: Thai locked, English editable and audited). If published meetings should count, change `fetchEnglishDraftCount`.
- A published meeting without an eligible-voter list (test data only) shows "0 of 0" and "quorum not reached".

---

## Before req numbers: demo-feedback #16 and #17 (status: done, PR #64 merged, checked by the chat 2026-11-19)
Back link on the record page `/record/[snapshotId]` and rename of the two result actions to "ดูบันทึกผล (หน้าเว็บ)" / "View record (web page)" and "ดาวน์โหลด PDF ฉบับทางการ" / "Download official PDF".

### Result
**PR #64** (https://github.com/alien07/condo_vote/pull/64), branch `fix/record-page-nav`, one commit, 10 files (+65/−20). alien07 merged it into `dev` on 2026-11-19 12:51 UTC while CI was still running; CI run 44527057724 on head `890d856` then finished green at 12:53 UTC (E2E smoke tests and Demo seed check included).

What changed:
- **#16:** "กลับ" / "Back" link above the record toolbar (`BackLink`, hidden when printing). Results links add `?from=results`, Audit links `?from=audit`; with no `from` it goes to `/admin/results`. An auditor who is not an admin goes to `/audit`.
- **#17:** `results.officialRecord`, `audit.officialRecord`, `meetings.openRecord` = "ดูบันทึกผล (หน้าเว็บ)"; `results.officialPdf` = "ดาวน์โหลด PDF ฉบับทางการ". The record page's hard-coded "Master PDF" link and English toolbar note now come from i18n.
- Help: auditor section of `lib/help/committee-guide.ts`. Docs: `docs/admin-workflows.md`, `docs/demo-script.md`. Tests: `tests/e2e/admin/08-results.spec.ts`.
- Checks: npm ci, lint, typecheck, test:unit (84), build; local e2e smoke set 36 passed; vote-flow, privacy and the `@full` lifecycle 7 passed.

Left over (candidates for new reqs):
- The meeting record page (`/admin/meetings/[id]/record`) links to `/record/<id>` without `from`, so Back goes to admin Results. Add `from=meeting` if wanted.
- Help quick-guide PDFs were not rebuilt (only the auditor paragraph changed).
- The merged branch `fix/record-page-nav` can be deleted.
