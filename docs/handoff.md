# Handoff: chat → Claude Code cloud session (environment "Condo")

How it works (user decision 2026-11-19): every task has a number `req_####` from `claude/requirements.md`. The chat only collects requirements and hands them off; Claude Code does the work; the chat checks the result again.

1. The chat writes the task here under `## req_####` (what, where, acceptance criteria) and starts a one-off scheduled task in environment `env_0139gTvk4LLh9uPB2L2WnypF` (Condo) whose prompt names the req number and this doc.
2. Claude Code: branch `<type>/req-####-<topic>` from `dev`; PR title starts with `[req_####]`; commits carry a `Req: req_####` line. Run npm ci, lint, typecheck, test:unit, build, test:db when the database changes, the related e2e specs, then the full CI run (`ci.yml` workflow_dispatch `full=true`). Squash merge when everything is green. Then fill the req's **Result** below (PR number, what changed, checks run, anything left) and set its status in `claude/requirements.md` to `done (PR #N)`.
3. The chat checks the PR and CI, pulls `dev` onto the Windows machine with migrations, renders the pages at 1440/768/375, compares with the acceptance criteria, and sets the status to `verified` or opens a follow-up req.

---

## req_0001: documents page review fixes (status: sent)
Started before req numbers existed: it is being done by the Claude Code agent the chat started in the background, on branch `fix/documents-page` (not pushed yet). Brief: `claude/todo-admin-documents.md`.

### Result
(Claude Code writes here: PR number, what changed, checks run, anything left)

---

## req_0002: audit log details still show raw values (status: sent)
Branch `fix/req-0002-audit-values`. Page `/admin/setup?tab=audit`; helper `features/admin/components/sections/setup/audit-log-labels.ts` (`valueText`, `auditDetailPairs`), words in `lib/i18n/staff/audit-log.ts` (`values`, `fields`).

Problem (found when checking #63): some detail values are still stored codes, e.g. a correction level change shows "เป็น: high / จาก: low". Free text that people typed (e.g. an answer "ok") stays as typed.

Do:
- Translate the correction levels `low` / `medium` / `high` (reuse the committee words: ต่ำ / กลาง / สูง, Low / Medium / High) in the audit details.
- Scan the local demo database (`audit_logs.details`) and the code that writes audit details (`writeAuditLog` calls and SQL functions that insert into `audit_logs`) for every other string value that is a stored code (status, type, source, role, level, provider …) and add the missing ones to `values` in Thai and English. Prefer reusing existing code words (`s.common.code` / `codeLabel`) over duplicating them.
- Unit tests in `audit-log-labels.test.ts` for the new values.

Acceptance: no audit detail on `/admin/setup?tab=audit` (demo data) shows a lowercase code value in Thai or English; typed text is unchanged; "Raw data" still shows the stored JSON.

### Result
(Claude Code writes here)

---

## req_0003: hydration mismatch warnings on admin pages (status: sent)
Branch `fix/req-0003-hydration`.

Problem (found when checking #63/#64, dev server on Windows): the browser console shows "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up." on nearly every admin page: `/admin/setup` (all tabs), `/admin/results`, and others. The pages look right, but React keeps the server attributes, so something may be wrong after hydration.

Do:
- Reproduce with Playwright on the dev server (`npm run dev`), signed in through `/auth/local-demo?as=admin`, capturing the full console message (React prints the differing attribute and component in the diff). Check `/admin`, `/admin/setup`, `/admin/results`, `/admin/meetings`, `/admin/voting`, `/admin/communications`, `/admin/documents`, `/committee`, `/vote`.
- Find the cause (typical: `Date.now()`/`new Date()` or locale/time-zone formatting during render, `Math.random()`/generated ids, `typeof window` branches, browser-only state such as localStorage used in the first render, or `useSyncExternalStore` with different server/client snapshots). Fix it at the source; do not add `suppressHydrationWarning` except for a value that must differ (e.g. a live clock), and explain any such case.
- Add an e2e check (e.g. in `tests/e2e/app-shell.spec.ts` or a new spec) that fails when a hydration warning is logged on the main admin pages.

Acceptance: no hydration warning in the console on the pages above, at 1440 and 375 px.

### Result
(Claude Code writes here)

---

## req_0004: accounts waiting for approval are hard to find (status: sent)
Branch `feat/req-0004-pending-accounts`. User decision 2026-11-15, recorded in `claude/demo-feedback.md` ("To do when reviewing the admin pages").

Problem: the admin overview (`app/admin/page.tsx`, `MetricCard` list) has no card for accounts waiting for approval, and the Users tab of Rooms & Owners (`/admin/people?tab=users`, `features/admin/components/sections/people/profiles-panel.tsx`) filters only by name and default status, not by approval status.

Do:
- Overview: a card "บัญชีรออนุมัติ" / "Accounts waiting for approval" with the count (profiles with `approval_status = 'pending'`), status "ต้องตรวจ" when > 0 and "เรียบร้อย" when 0, like the pending proxies card, linking straight to the Users tab filtered to pending. Only for roles that may approve accounts (check `lib/auth/permissions` and the staff nav rules in `app/admin/layout.tsx`).
- Users tab: an "สถานะการอนุมัติ" / "Approval status" filter (all / pending / approved / rejected …, the values the column really has), kept in the URL (e.g. `?approval=pending`) like the other filters; approval status shown as a colour badge in the list (and phone cards if the list has them).
- i18n TH/EN, unit test for any helper, e2e: the card shows the pending count and its link opens the Users tab with only pending accounts.

Acceptance: from `/admin`, one click reaches the list of only the accounts waiting for approval; the filter works on its own from the Users tab and survives paging.

### Result
(Claude Code writes here)

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
