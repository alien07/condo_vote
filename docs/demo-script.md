# Demo script: live test on a local machine

A step-by-step demo and test guide for condoVotes, using the data from
`scripts/seed-demo.mjs` (redesigned in req_0010). It follows the people who
use the system, role by role: Manager → Office staff → Committee and chair →
Owners (Thai and English) → Auditor → System Admin. Each step has
**✓ Expected** underneath.

`tests/e2e/demo-seed.spec.ts` checks the data below and a role matrix (every
menu link opens, and the pages a role must not open are denied) in CI.

---

## 0. Preparation (about 5 minutes)

```powershell
npx supabase start
npm run build
npm run demo:seed -- --reset --consent      # clears the local DB and seeds again (times count from now)
$env:ENABLE_LOCAL_AUTH_BYPASS="1"; npm run start
```

- Open **http://localhost:3000** (Google sign-in is not set up for a LAN IP).
- `--reset` clears the whole local database, including the Google sign-in, so sign in again after each run.
- `--consent` turns the PDPA screen on; seeded people have accepted already, only the new user sees it.
- With `npm run dev` the demo buttons work without the variable.

### People (demo buttons on the sign-in page, grouped by role)

| Group | Button | Email | Roles · what to show |
|---|---|---|---|
| Building office | คุณมานพ ผู้จัดการ (Manager) | manager@example.test | `admin` (Manager) · meetings, results, corrections, approvals of accounts and proxies |
| Building office | คุณสมศรี เจ้าหน้าที่ (Staff) | staff@example.test | `staff` · rooms, owners, paper ballots; no Manager pages |
| Building office | Audrey Auditor | auditor@example.test | `auditor` · read only, English |
| Committee | คุณประพันธ์ ประธานกรรมการ | chair@example.test | `committee`, chair · approves, breaks a tie · owns A-104 |
| Committee | คุณวิไล รองประธาน | vice.chair@example.test | `committee`, vice chair · owns A-108 |
| Committee | Mark Member | member@example.test | `committee`, English · still to answer M9 · owns A-202 |
| Owners | คุณอนันต์ เจ้าของ 2 ห้อง | owner.th@example.test | Thai · owns A-101, A-102 · proxy for A-103 (approved), A-105/A-106 (pending) |
| Owners | Emma English | owner.en@example.test | English · owns A-201 · voted online **and** on paper in M8 |
| Owners | คุณชัยวัฒน์ เจ้าของร่วมหลัก | owner.co@example.test | owner of A-110 · lets the co-owner vote in M1 |
| Owners | คุณชลธิชา ผู้ถือกรรมสิทธิ์ร่วม | co.owner@example.test | resident · votes A-110 in M1 for the owner |
| Owners | คุณรัตนา ผู้อยู่อาศัย | resident@example.test | resident, not an owner · results only |
| Owners | Peter Proxy | proxy.holder@example.test | external proxy holder, English · votes A-107 in M1 |
| Owners | คุณนภา ผู้ใช้ใหม่ | new.user@example.test | no profile yet · PDPA, then waits for approval |
| System | System Admin (Demo) | system.admin@example.test | `system_admin` only · no building rights (D027) |
| (Google) | — | manorin.prajak@gmail.com | `system_admin` only, like the demo System Admin |

Two more committee members exist without a button (คุณสุนทร A-203, คุณกมล
A-205), so the committee has **5 active members: a decision needs 3**
(D027). The local "Dev admin" link (admin + system admin) is for developers,
not for the demo.

### Meetings (every title, agenda item and choice in Thai and English)

| Meeting | State |
|---|---|
| M1 | Meeting-day voting open (closes in 3 days) · proxies A-103 and A-107 approved, A-105/A-106 pending · co-owner votes A-110 · personas have not voted |
| M2 | Advance voting open; meeting day in 9 days |
| M3 | Secret ballot, open (the Manager sees totals only) |
| M4 | Published, meeting in 12 days |
| M5 | Published with short notice (4 days); the Manager's confirmation is in the audit log |
| M6 | Draft ready to publish, meeting in 3 days (shows the 7-day notice rule) |
| M7 | Draft · 4 pass-rule types + a land office question |
| M8 | Voting closed · A-201 online + paper conflict · A-205 paper ballot identity unconfirmed |
| M9 | Result waiting · approved 2 of 3 (chair, vice chair) · Mark has not answered |
| M10 | Result **did not pass** · 1 approved, 3 not approved with reasons · the Manager was emailed |
| M11 | **Tie** 2–2 · คุณกมล generated the result, so may not answer (D022) · waits for the chair |
| M12 | Correction request (medium, by Mark) waits for the Manager · vice chair approved |
| M13 | Published · full meeting record (notice, identity method, 1 incident) · approved 3 of 5 |
| M14 | Second call (reconvened) · no quorum needed · published |
| M15 | Last year · published and archived |

### Checkpoint 0
1. Sign in as **Manager** → Building office › Results → row **DEMO M13** → **Create PDF files**
   - ✓ Expected: the button counts up to all files within about 10 seconds
2. Sign out

---

## 1. Manager (คุณมานพ)

1. Sign in → **Building office** (overview)
   - ✓ Expected: "Waiting for you" shows the proxy requests (A-105, A-106), the paper ballots and the conflict of M8, results waiting, and **"ผลที่ไม่ผ่านการอนุมัติ" 1** (M10). The header reads ผู้จัดการ, never "admin"
2. Results → filter **ไม่ผ่านการอนุมัติ**
   - ✓ Expected: M10 with the three reasons; no Approve button (the Manager is not a committee member)
3. Meetings → **M6 (draft, in 3 days)** → Publish
   - ✓ Expected: the confirm adds a warning that the meeting day is less than 7 days away; publishing works and the audit log records the confirmation. (With the System Admin's strict rule on, the button is replaced by the reason: see 6.)
4. Voting › Online + paper → **M8 · A-201** → choose a source with a reason; paper ballots → **A-205** → link the voter (คุณกมล)
   - ✓ Expected: both resolved; Meetings → **Generate result** for M8 now works
5. Results → **M12** → answer the correction request "No change needed"
   - ✓ Expected: the request closes; M12 still needs approvals (1 of 3)
6. Proxies → M1 → approve **A-105**; try a fourth proxy for คุณอนันต์
   - ✓ Expected: approved; the fourth is refused (at most three rooms per proxy)
7. Communications → M1 invites
   - ✓ Expected: Thai/English per recipient; one **failed** row (A-209) to resend; M2 has queued rows

## 2. Office staff (คุณสมศรี)

1. Sign in
   - ✓ Expected: menu shows only Overview, People, Ownership, Voting (no Meetings, Results, Committee or Audit); overview cards a staff member cannot open show a count without a link (req_0009)
2. People › Users
   - ✓ Expected: read only; no grant or revoke
3. People › Import → the files in `demo/excel/` (built by `npm run demo:excel`), in this order:

| # | File | Sheet | ✓ Expected |
|---|---|---|---|
| 1 | `demo-1-rooms.xlsx` | Rooms | rooms B-301..B-303 added |
| 2 | `demo-2-owners.xlsx` | Owners | 3 new owners · คุณอนันต์'s phone changes to 0899999999 (upsert by email) |
| 3 | `demo-3-room-owners.xlsx` | RoomOwners | B-301..B-303 have owners |
| 4 | `demo-err-rooms-zero-percent.xlsx` | Rooms | error: ownership_percent must be greater than 0 · nothing saved |
| 5 | `demo-err-room-owners-unknown-room.xlsx` | RoomOwners | error: room "Z-999" not found |
| 6 | `demo-err-room-owners-unknown-email.xlsx` | RoomOwners | error: owner email not found |
| 7 | `demo-err-room-owners-active-owner.xlsx` | RoomOwners | error: room A-101 already has an active owner |

4. Ownership → check A-101 active, A-209 ended + new owner, A-210 scheduled, A-208 cancelled
   - ✓ Expected: the right badges; a cancelled link cannot be edited

## 3. Committee and chair

1. Sign in as **Mark Member** (English) → Committee
   - ✓ Expected: "5 active committee members. A decision needs a majority of 3". **M9** reads "Approved 2 · Not approved 0 · Needs 3 of 5" with Approve / Do not approve / Request a correction; **M11** says it waits for the chair; **M10** shows "did not pass" with the reasons
2. Approve **M9**
   - ✓ Expected: "Result approved and published"; owners are emailed and the PDFs are made
3. Sign in as **คุณวิไล (vice chair)** → **M12**: already approved (the badge); nothing to do. Try M11
   - ✓ Expected: already answered; answers cannot change
4. Sign in as **คุณประพันธ์ (chair)** → **M11**
   - ✓ Expected: a panel "คะแนนเท่ากัน ท่านในฐานะประธานกรรมการเป็นผู้ชี้ขาด" with "ชี้ขาด: อนุมัติ" / "ชี้ขาด: ไม่อนุมัติ"
5. Choose **ชี้ขาด: อนุมัติ** → confirm
   - ✓ Expected: published; the official record says the chair decided (ประธานลงคะแนนชี้ขาด) and keeps n of N
6. Close early: on **M1**, propose closing with a reason
   - ✓ Expected: needs 3 of 5; each member answers once

## 4. Owners

**คุณอนันต์ (Thai)**
1. Vote page
   - ✓ Expected: Thai. M1 lists A-101, A-102 (owner) and A-103 (proxy); M2 open (advance); M3 secret ballot
2. M1 · A-101: choose; try a third candidate in agenda 2 → submit → change and submit again
   - ✓ Expected: at most 2 candidates; "ฉบับที่ 1", then "ฉบับที่ 2"

**Emma English**
1. Summary
   - ✓ Expected: English titles and tables; the newest meeting (M14) is shown; M13 in the history; "All results" lists M15
2. M13 → "What this means" tips on the deciding column; download the English PDF; **Verify this reference**
   - ✓ Expected: the tip explains the base; the hash matches

**คุณชัยวัฒน์ and คุณชลธิชา (co-owner)**
1. คุณชัยวัฒน์ → Vote → M1 · A-110
   - ✓ Expected: the co-owner votes for this room; the owner can take it back until the co-owner votes
2. คุณชลธิชา → Vote
   - ✓ Expected: M1 · A-110 is open for her

**Peter Proxy (external, English)** → Vote → M1 · A-107. **คุณรัตนา (resident)** → Results only, no Vote rooms. **คุณนภา (new user)** → PDPA screen first, then "waiting for approval"; the Manager approves her in People.

## 5. Auditor (Audrey, English)

1. Audit
   - ✓ Expected: read only. Published results with "Approved by 3 of 5 members (needed 3)" (M11: "Decided by the chair's deciding vote" after step 3.5); correction requests (M12); the activity log in words, including the System Admin's past temporary access

## 6. System Admin

1. Sign in as **System Admin (Demo)** → try **Building office**
   - ✓ Expected: denied: the role gives no building rights
2. System → **Temporary access**: reason "Check the M8 conflict", 1 hour → Open
   - ✓ Expected: a notice on every page; Building office, Committee and Audit open **read only** (saving anything fails); the Manager's overview and Audit show the banner with the reason
3. **End access now**
   - ✓ Expected: closed again; start and end are in the audit log
4. System → **Meeting notice period** → turn strict on → save; then as the Manager open M6 (if not published yet)
   - ✓ Expected: no Publish button, the reason instead
5. System › Privacy → change the notice text → save; then sign in as any owner
   - ✓ Expected: the new version must be accepted again

---

## Already covered by CI (no need to show)
- `demo-seed.spec`: this data and the role matrix for every persona
- `committee-majority`, `system-access`, `notice-period`, `vote-flow`, `role-access`, `privacy`, `language`, `table-search`, `audit-page`, `app-shell`, `admin/*` specs
- pgTAP: committee majority and casting vote, System Admin apart, notice period, function grants, ballot secrecy, proxy limit, result documents
- Vitest: pass rules and quorum, overview counts, translations

## Known limits
- Times count from when the seed runs. Run `--reset` before each demo; it wipes the local database.
- M11's tie relies on the fifth member having generated the result (seeded so; in the app only the Manager generates results).
- The Excel importer stops at the first bad row and keeps the rows before it.
- A room with a scheduled ownership transfer (A-210) drops out of the voter list when a meeting is published through the app (publishing uses links with no end date).
- Documents in the registry (proxy A-103, A-201 title deed) are metadata only; there is no file at the path.
- Emails are not sent (`example.test`); invite rows show a sent status for display only.
- Temporary access does not open files in Storage (private documents).
- Before running the e2e tests on this machine, run `npx supabase db reset` without the seed (`--consent` turns the PDPA screen on).
- On a phone on the same Wi-Fi, open `http://<PC IP>:3000` and use the demo buttons; **Sign in with Google does not work over a LAN IP**.
- The demo buttons appear only on localhost/LAN; `next start` also needs `ENABLE_LOCAL_AUTH_BYPASS=1` and a local Supabase URL.
