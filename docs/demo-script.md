# Demo script: live test on a local machine

A step-by-step test case and demo guide for condoVotes, using data from `scripts/seed-demo.mjs`.
Each step has **✓ Expected** underneath, and every flow ends with a checkpoint.

- **P1** · show the client (~35 minutes): F1–F4
- **P2** · check yourself before the client meeting: F5–F7
- **P3** · already covered by CI, no need to show again (list at the end)

---

## 0. Preparation (about 5 minutes)

```powershell
npx supabase start
npm run build
npm run demo:seed -- --reset --consent      # clears the local DB and seeds again (meeting times count from now)
$env:ENABLE_LOCAL_AUTH_BYPASS="1"; npm run start
```

- Open **http://localhost:3000** only (Google OAuth is not set up for the LAN IP).
- `--reset` clears the whole local database, including the Google sign-in, so sign in again after every run.
- `--consent` turns the PDPA screen on (the local seed turns it off). Only F4 needs it, but use it every time.
- With `npm run dev`, the bypass buttons work without setting the variable.

### Users (demo login buttons on the sign-in page)

| Button | Email | Role / case |
|---|---|---|
| (Google) | manorin.prajak@gmail.com | system admin + admin + committee · F4, 2nd approval in F2 |
| Demo Admin · แก้ M6/ออกผล | admin.fix-results@example.test | admin only · F2, F5, F6 |
| Demo Committee · อนุมัติผล | committee.approve@example.test | committee only · F2, F7 |
| Owner A · TH · 2 ห้อง + รับมอบฉันทะ | owner.th.2rooms-proxy@example.test | Thai · owns A-101, A-102 · proxy for A-103 · F1 |
| Owner B · EN · online + paper | owner.en.paper-conflict@example.test | English · A-201 · voted online and on paper · F3 |
| Resident · ไม่ใช่เจ้าของ | resident.no-vote@example.test | resident with no room · F7 |
| New user · รอ PDPA/อนุมัติ | new.pending-consent@example.test | no profile yet · F4 |

### Meetings

| Meeting | State | Used in |
|---|---|---|
| M1 | Meeting-day voting open (closes in 3 days) · open ballot · 1 single-choice question + 1 multiple-choice question (max 2) · proxy A-103 approved, A-105/A-106 pending · closing early needs 2 approvals | F1 |
| M2 | Advance voting window open | F1, F5 |
| M3 | Between the advance window and meeting day (cannot vote) | F5 |
| M4 | Secret ballot, open | F1 |
| M5 | Draft · 4 pass-rule types + land office question | F5 |
| M6 | Voting closed · A-201 has an online + paper conflict · A-205 paper ballot identity unconfirmed · quorum not met | F2 |
| M7 | Result generated · approvals 1/2 | F2, F7 |
| M8 | Published · full meeting record (notice, identity method, 1 incident) · Q1 decided, Q2 not decided | F3 |
| M9 | Second meeting (reconvened) · no quorum required · published | — |
| M10 | Last year · archived | — |

### Checkpoint 0
1. Log in as **Demo Admin** → Admin › Results → in row **DEMO M8**, click **Create PDF files (0/3)**
   - ✓ Expected: the button changes to 3/3 within about 10 seconds
2. Log out

---

## P1 · Show the client

### F1 · Owner A votes (~8 minutes)
1. Log in as **Owner A**
   - ✓ Expected: Thai UI. The Vote page lists meetings by room: A-101, A-102 (owner) and A-103 (proxy)
2. Open **DEMO M1 · room A-101** → choose "เห็นด้วย" for Q1 → try to choose 3 candidates for Q2
   - ✓ Expected: Q2 says "choose up to 2", and a 3rd choice is not accepted (cannot be selected, or an error on submit). There is an Abstain choice on each question
3. Choose 2 candidates → submit
   - ✓ Expected: "ส่งแล้ว ฉบับที่ 1"
4. Open M1 · A-101 again → change your answer → submit
   - ✓ Expected: "ฉบับที่ 2" (the ballot can be changed until voting closes)
5. Open **M1 · room A-103 (proxy)** → vote
   - ✓ Expected: works like an own room; the label says proxy
6. Open **DEMO M4 (secret ballot)** · A-101 → vote
   - ✓ Expected: the page says it is a secret ballot
7. Open **DEMO M3**
   - ✓ Expected: status "ยังไม่เปิด", with the meeting-day opening time; cannot vote

**Checkpoint F1:** log in as Demo Admin → Admin › Voting → M1: the online ballot count goes up by 2 (A-101, A-103). For M4, admin sees only totals, not per-room choices.

### F2 · Admin fixes M6 → generates the result → committee approves 2 times → published (~12 minutes)
1. Log in as **Demo Admin** → Admin › Meetings → in row M6, click **Generate result**
   - ✓ Expected: refused, because of a pending paper-ballot identity
2. Admin › Voting › Paper ballots → M6 · room **A-205** → link the voter to **Voter A-205** → save
   - ✓ Expected: status changes from pending to linked
3. Admin › Voting › Online + paper rooms → **DEMO M6 · A-201** → **Review / choose source**
   - ✓ Expected: both ballots shown side by side (online: agree; paper: disagree)
4. Choose **paper** and give a reason, for example "เจ้าของยืนยันใช้บัตรกระดาษ" → save
   - ✓ Expected: status "chosen"
5. Admin › Meetings → **Generate result** for M6 again
   - ✓ Expected: rooms that voted 4/20, ownership 19% → **quorum not met** (rule: 25%). A-201 counts as paper
6. Log out → log in as **Demo Committee** → Committee → approve M6
   - ✓ Expected: "1/2", not yet published
7. Log out → log in with **Google** (manorin.prajak@gmail.com) → Committee → approve M6
   - ✓ Expected: published; result emails are queued (Admin › Communications)
8. Results → M6 → **Create PDF files**, then open the **Official record**
   - ✓ Expected: 3 PDF files. The record shows the quorum, the conflict and the reason chosen, and the SHA-256

**Checkpoint F2:** in Admin › Communications there are `result_approved` emails in Thai/English, matching each owner's language.

### F3 · Owner B reads the English summary (~5 minutes)
1. Log in as **Owner B**
   - ✓ Expected: English UI (the profile language is en)
2. Summary → the latest summary (M6 if F2 is done, otherwise M8)
   - ✓ Expected: English table, with the note "If it differs from the Thai version, the Thai version prevails"
3. Open M8 → download the PDF summary (EN)
   - ✓ Expected: an English PDF with the same numbers as the page
4. Click **Verify this reference**
   - ✓ Expected: the verify page shows the hash matches
5. Click **ไทย** at the top right
   - ✓ Expected: the whole page switches to Thai, and the setting persists after signing in again

### F4 · System admin + PDPA + approving a new user (~10 minutes)
1. Log in with **Google** (manorin.prajak@gmail.com) → System › PDPA → edit the notice text (Thai + English) → save
   - ✓ Expected: the notice version goes up by 1
2. Open another window (incognito) → log in as **New user**
   - ✓ Expected: goes to the PDPA screen first. Data pages cannot be opened until it is accepted
3. Accept
   - ✓ Expected: goes into the app with pending status (the header shows the email + role)
4. Back in the admin window → Admin › People → open the New user → set the approval status to approved → save
   - ✓ Expected: status changes to approved. The Vote page has no rooms yet, because this email is not in the owner register and the snapshot was taken at publish time
5. Log in as **Owner A** again
   - ✓ Expected: must accept the new PDPA version (the version changed in step 1)

---

## P2 · Check before the client meeting

### F5 · Meeting setup and voting windows
1. Admin › Meetings → open **M5 (draft)**
   - ✓ Expected: 4 pass-rule types shown correctly. Question 3 shows the land office flag
2. Create a new meeting: set the advance window to end **after** the meeting-day start → save
   - ✓ Expected: validation error about the time order
3. Fix it → add a multiple-choice question with max_choices = 0
   - ✓ Expected: validation error
4. Publish
   - ✓ Expected: the eligible-voter snapshot includes every room that has an approved owner (see known limits about A-210)
5. As Owner A, compare M2 (advance window open, can vote) with M3 (cannot vote yet)

### F6 · Excel import, ownership, emails
Files are in `demo/excel/` (built from the real templates by `npm run demo:excel`). Import in this order under Admin › People › Import:

| # | File | Sheet | ✓ Expected |
|---|---|---|---|
| 1 | `demo-1-rooms.xlsx` | Rooms | "นำเข้าห้องเสร็จแล้ว" · rooms B-301..B-303 added |
| 2 | `demo-2-owners.xlsx` | Owners | "นำเข้าเจ้าของเสร็จแล้ว" · 3 new owners · Owner A's phone changes to 0899999999 (upsert by email) |
| 3 | `demo-3-room-owners.xlsx` | RoomOwners | "นำเข้าห้อง-เจ้าของเสร็จแล้ว" · B-301..B-303 have owners |
| 4 | `demo-err-rooms-zero-percent.xlsx` | Rooms | Error: row 5 ownership_percent must be greater than 0 · nothing saved |
| 5 | `demo-err-room-owners-unknown-room.xlsx` | RoomOwners | Error: room "Z-999" not found |
| 6 | `demo-err-room-owners-unknown-email.xlsx` | RoomOwners | Error: owner email "nobody.missing@example.test" not found |
| 7 | `demo-err-room-owners-active-owner.xlsx` | RoomOwners | Error: row 5 · room A-101 already has an active owner (Owner A) |

Then:
- Admin › Ownership → check the 4 states:
  - A-101 active
  - A-209 ended (old owner) + active (new owner)
  - A-210 scheduled
  - A-208 cancelled
  - ✓ Expected: correct status badges, and a cancelled link cannot be edited
- Admin › Proxies → M1 → add a proxy from **A-107 → Owner A**
  - ✓ Expected: error "One proxy can hold at most three rooms per meeting" (Owner A already holds 3: 1 approved + 2 pending)
- Admin › Communications → M1 invites
  - ✓ Expected: Thai/English versions per recipient. voter.a110 shows **failed** with an error; resend it
  - ✓ Expected: a new queued row for M2

> The importer imports in rooms → owners → room-owners order. Use the error files only after files 1–3. Every file holds a single row, because the importer stops at the first bad row and **keeps the rows before it** (see known limits).

### F7 · Access by role
| Who | Try | ✓ Expected |
|---|---|---|
| Resident | `/admin`, `/committee`, `/vote` | Cannot open admin/committee pages. The Vote page shows no rooms |
| Demo Admin (not system admin) | `/system` | Cannot open it |
| Demo Committee | `/admin` | Cannot open it; can open `/committee` and see M7 waiting (1/2) |
| Demo Committee | Approve M7 | Published (2/2) |

---

## P3 · Already covered by CI (no need to show again)
- `vote-flow.spec`: owner/proxy voting, editing a ballot, voting closed
- `admin-demo.spec`: meeting CRUD/publish, paper ballots, conflicts, results/approvals, communications, documents, ownership
- `role-access.spec`, `privacy.spec`, `language.spec`, `table-search.spec`, `app-shell.spec`
- `demo-seed.spec` (new): checks that the seed matches this script (20 rooms = 100%, M6/M7/M8/M10 states, emails th/en + failed, login buttons, consent)
- pgTAP: ballot secrecy, committee approvals, proxy limit, result documents/PDF, owner language
- Vitest: pass rules / quorum, message translation

## Known limits
- Meeting times count from when the seed runs. Run `--reset` again before every demo; it wipes the whole local database.
- The RoomOwners/Owners Excel import stops at the first bad row, and the rows before it are already saved (no whole-file rollback).
- A room with a scheduled ownership transfer (A-210: current owner has an end date, buyer starts next month) **drops out of the snapshot** when a meeting is published through the app, because publishing uses only links with no end date. The seeded meetings include A-210. This should go to the backlog.
- The archived meeting (M10) shows in Owner A's Vote list as a meeting with no title.
- Some expected results in F1 step 2, F2 steps 2–4, F4 and F5 come from reading the code; the parts tested on screen are the states of all 10 meetings, the login buttons, the PDPA screen, conflict page M6, the results page, the owner summary, and creating PDFs for M8. If a step differs from what you see, write it down and send it to me.
- Documents in the registry (proxy A-103, A-201 title deed) are metadata only; there is no real file at the path.
- Emails are not actually sent (`example.test` domain); invite rows have a sent status for display only.
- Admin pages still show dates in English format.
- The bypass buttons appear only on localhost/LAN. `next start` additionally needs `ENABLE_LOCAL_AUTH_BYPASS=1` and a local Supabase URL.
