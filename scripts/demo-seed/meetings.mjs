// Demo meetings M1-M15 (req_0010, docs/demo-script.md). Every title, agenda
// item and choice has Thai and English; times are relative to the run.

import { MINUTE, HOUR, DAY, at } from "./context.mjs";
import { personaProfile } from "./people.mjs";
import { AGREE_DISAGREE, STANDARD_QUESTIONS, createMeeting, votes } from "./meeting-builder.mjs";

console.log("[demo:seed] meetings ...");

// Rooms that vote in the closed meetings (the personas' own rooms stay open
// where a persona should still be able to act).
export const CLOSED_VOTERS = ["A-101", "A-103", "A-104", "A-106", "A-108", "A-110", "A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-210"];

// ---------------------------------------------------------------- open now

// M1: meeting-day voting open. คุณอนันต์ votes 2 own rooms + A-103 by proxy;
// A-105 and A-106 proxies wait for the Manager; Peter Proxy holds A-107; the
// owner of A-110 lets the co-owner vote (results step). Personas have not
// voted yet.
await createMeeting({
  key: "M1",
  title: ["DEMO M1 · ประชุมใหญ่สามัญประจำปี 2569 (เปิดลงคะแนนวันประชุม)", "DEMO M1 · Annual general meeting 2026 (meeting-day voting open)"],
  meeting_number: "1/2569",
  starts_at: at(-HOUR),
  ends_at: at(3 * DAY),
  status: "published",
  notice_sent_at: at(-15 * DAY),
  proxies: [
    { room: "A-103", status: "approved", document: true },
    { room: "A-105", status: "pending" },
    { room: "A-106", status: "pending" },
    { room: "A-107", status: "approved", holder: personaProfile.proxyHolder },
  ],
  online: votes(["A-109", "A-204", "A-206", "A-207", "A-209"], at(-30 * MINUTE)),
});

// M2: advance voting open now; meeting day in 9 days.
await createMeeting({
  key: "M2",
  title: ["DEMO M2 · ลงคะแนนล่วงหน้า (เปิดอยู่)", "DEMO M2 · Advance voting (open now)"],
  starts_at: at(9 * DAY),
  ends_at: at(9 * DAY + 4 * HOUR),
  advance_starts_at: at(-DAY),
  advance_ends_at: at(2 * DAY),
  status: "published",
  notice_sent_at: at(-6 * DAY),
  online: votes(["A-204", "A-206", "A-207"], at(-2 * HOUR)),
});

// M3: secret ballot, open: the Manager sees totals only (D015).
await createMeeting({
  key: "M3",
  title: ["DEMO M3 · ลงคะแนนลับ (เปิดอยู่)", "DEMO M3 · Secret ballot (open now)"],
  meeting_type: "egm",
  starts_at: at(-2 * HOUR),
  ends_at: at(2 * DAY),
  ballot_secrecy: "secret",
  status: "published",
  notice_sent_at: at(-14 * DAY),
  questions: [
    {
      agenda_no: "1",
      agenda_title: ["ถอดถอนผู้จัดการ", "Remove the manager"],
      question_text: ["เห็นควรถอดถอนผู้จัดการนิติบุคคลหรือไม่ (ลงคะแนนลับ)", "Should the juristic manager be removed? (secret ballot)"],
      question_type: "single_choice",
      required_threshold: "half_total",
      choices: AGREE_DISAGREE,
    },
  ],
  online: votes(["A-109", "A-204", "A-208"], at(-HOUR)),
});

// ---------------------------------------------------------------- coming up

// M4: published, meeting in 12 days (notice given in time).
await createMeeting({
  key: "M4",
  title: ["DEMO M4 · ประชุมวิสามัญ (อีก 12 วัน)", "DEMO M4 · Extraordinary meeting (in 12 days)"],
  meeting_type: "egm",
  starts_at: at(12 * DAY),
  ends_at: at(12 * DAY + 4 * HOUR),
  status: "published",
  notice_sent_at: at(-2 * DAY),
});

// M5: published with short notice: meeting in 4 days. The Manager confirmed
// the warning (results step writes the audit row, D027 C).
await createMeeting({
  key: "M5",
  title: ["DEMO M5 · ประชุมด่วน (อีก 4 วัน แจ้งล่วงหน้าไม่ครบ 7 วัน)", "DEMO M5 · Urgent meeting (in 4 days, under 7 days' notice)"],
  meeting_type: "egm",
  starts_at: at(4 * DAY),
  ends_at: at(4 * DAY + 3 * HOUR),
  status: "published",
  notice_sent_at: at(-HOUR),
  questions: [STANDARD_QUESTIONS[0]],
});

// M6: draft, ready to publish, meeting in 3 days: publishing shows the
// notice warning, or is refused when the System Admin turns strict on.
await createMeeting({
  key: "M6",
  title: ["DEMO M6 · ร่าง พร้อมเผยแพร่ (อีก 3 วัน)", "DEMO M6 · Draft ready to publish (in 3 days)"],
  meeting_type: "egm",
  starts_at: at(3 * DAY),
  ends_at: at(3 * DAY + 3 * HOUR),
  status: "draft",
  questions: [STANDARD_QUESTIONS[0]],
});

// M7: draft with each pass rule type and a land office question.
await createMeeting({
  key: "M7",
  title: ["DEMO M7 · ร่างการประชุม (เกณฑ์มติ 4 แบบ)", "DEMO M7 · Draft meeting (4 pass rules)"],
  meeting_type: "egm",
  starts_at: at(20 * DAY),
  ends_at: at(20 * DAY + 4 * HOUR),
  status: "draft",
  questions: [
    { agenda_no: "1", agenda_title: ["เกินกึ่งหนึ่งของผู้ลงคะแนน", "Majority of votes cast"], question_text: ["อนุมัติแผนซ่อมสระว่ายน้ำ", "Approve the pool repair plan"], question_type: "single_choice", required_threshold: "majority_submitted", choices: AGREE_DISAGREE },
    { agenda_no: "2", agenda_title: ["เกินกึ่งหนึ่งของทั้งหมด", "Majority of all ownership"], question_text: ["ปรับอัตราค่าส่วนกลาง", "Change the common fee"], question_type: "single_choice", required_threshold: "half_total", choices: AGREE_DISAGREE },
    { agenda_no: "3", agenda_title: ["3 ใน 4 ของทั้งหมด", "Three quarters of all ownership"], question_text: ["แก้ไขข้อบังคับนิติบุคคลอาคารชุด", "Amend the condominium by-laws"], question_type: "single_choice", required_threshold: "three_fourths_total", land_office: true, legal_note: ["ต้องจดทะเบียนต่อสำนักงานที่ดิน", "Must be registered at the Land Office"], choices: AGREE_DISAGREE },
    { agenda_no: "4", agenda_title: ["แจ้งเพื่อทราบ", "For information"], question_text: ["รับทราบรายงานผลการดำเนินงาน", "Acknowledge the annual report"], question_type: "single_choice", required_threshold: "informational", choices: [["รับทราบ", "Acknowledged"]] },
  ],
});

// ---------------------------------------------------------------- closed

// M8: voting ended. Emma voted online AND on paper (conflict), and A-205's
// paper ballot has an unconfirmed identity: the result waits for both.
await createMeeting({
  key: "M8",
  title: ["DEMO M8 · ปิดลงคะแนนแล้ว (บัตรกระดาษต้องแก้ก่อนออกผล)", "DEMO M8 · Voting closed (paper ballots to sort out first)"],
  meeting_type: "egm",
  starts_at: at(-2 * DAY),
  ends_at: at(-DAY),
  status: "closed",
  notice_sent_at: at(-16 * DAY),
  online: [
    ...votes(["A-201"], at(-DAY - 3 * HOUR), (n, qs) => qs.map(() => [0])),
    ...votes(["A-202", "A-109", "A-104", "A-108", "A-110"], at(-DAY - 2 * HOUR)),
  ],
  manual: [
    {
      room: "A-201",
      identity: "linked",
      note: "เจ้าของยื่นบัตรกระดาษที่จุดลงทะเบียนด้วย",
      answers: (n, qs) => qs.map((q) => (q.question_type === "multiple_choice" ? [2, 3] : [1])),
    },
    {
      room: "A-205",
      identity: "pending",
      note: "ลายมือชื่อไม่ชัด",
      identityText: "ลายมือชื่ออ่านไม่ออก ต้องตรวจกับทะเบียนเจ้าของ",
    },
  ],
});

// M9-M12: results on the Committee page (results step answers them).
for (const [key, title, daysAgo] of [
  // Chair and vice chair approved (2 of 3 needed); Mark has not answered.
  ["M9", ["DEMO M9 · ผลรออนุมัติ (อนุมัติแล้ว 2 จาก 3)", "DEMO M9 · Result waiting (2 of 3 approvals)"], 9],
  // Three members did not approve, with reasons: not passed.
  ["M10", ["DEMO M10 · ผลไม่ผ่านการอนุมัติ", "DEMO M10 · Result did not pass"], 8],
  // 2 to 2; the fifth member generated the result, so may not answer:
  // a tie waiting for the chair (D027).
  ["M11", ["DEMO M11 · คะแนนเท่ากัน รอประธานชี้ขาด", "DEMO M11 · Tied, waiting for the chair"], 7],
  // A correction request waits for the Manager.
  ["M12", ["DEMO M12 · มีคำขอแก้ไขรอผู้จัดการตอบ", "DEMO M12 · Correction request waiting for the Manager"], 6],
]) {
  await createMeeting({
    key,
    title,
    meeting_type: "egm",
    starts_at: at(-(daysAgo + 1) * DAY),
    ends_at: at(-daysAgo * DAY),
    status: "closed",
    notice_sent_at: at(-(daysAgo + 15) * DAY),
    required_approvals: 1,
    online: votes(CLOSED_VOTERS, at(-daysAgo * DAY - 5 * HOUR)),
  });
}

// M13: published with the full meeting record. Q1 decided; Q2 needs 75% of
// total ownership and is not decided.
await createMeeting({
  key: "M13",
  title: ["DEMO M13 · เผยแพร่ผลแล้ว (บันทึกการประชุมครบ)", "DEMO M13 · Result published (full meeting record)"],
  meeting_type: "egm",
  meeting_number: "2/2569",
  starts_at: at(-14 * DAY - 3 * HOUR),
  ends_at: at(-14 * DAY),
  advance_starts_at: at(-17 * DAY),
  advance_ends_at: at(-15 * DAY),
  status: "closed",
  notice_sent_at: at(-30 * DAY),
  identity_method: "เข้าสู่ระบบด้วย Google และเทียบอีเมลกับทะเบียนเจ้าของร่วม",
  recording_reference: "DEMO/recordings/M13.mp4",
  traffic_log_reference: "DEMO/logs/M13-traffic.csv",
  questions: [
    STANDARD_QUESTIONS[0],
    {
      agenda_no: "2",
      agenda_title: ["แก้ไขข้อบังคับ", "Amend the by-laws"],
      question_text: ["แก้ไขข้อบังคับเรื่องการเลี้ยงสัตว์", "Amend the by-law on keeping pets"],
      question_type: "single_choice",
      required_threshold: "three_fourths_total",
      land_office: true,
      legal_note: ["ต้องจดทะเบียนต่อสำนักงานที่ดิน", "Must be registered at the Land Office"],
      choices: AGREE_DISAGREE,
    },
  ],
  online: [
    ...votes(["A-101", "A-102", "A-104", "A-108"], at(-16 * DAY)),
    ...votes(["A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-110", "A-105"], at(-14 * DAY - HOUR)),
  ],
  incidents: [
    {
      started_at: at(-14 * DAY - 2 * HOUR),
      ended_at: at(-14 * DAY - 2 * HOUR + 15 * MINUTE),
      description: "ระบบวิดีโอขัดข้องประมาณ 15 นาที",
      action_taken: "สลับไปใช้ลิงก์สำรองและขยายเวลาลงคะแนน 15 นาที",
    },
  ],
});

// M14: reconvened meeting, no quorum required; published.
await createMeeting({
  key: "M14",
  title: ["DEMO M14 · ประชุมครั้งที่สอง (ไม่ต้องครบองค์ประชุม)", "DEMO M14 · Second call (no quorum needed)"],
  meeting_round: "reconvened",
  quorum_rule: "not_required_second_call",
  required_approvals: 1,
  starts_at: at(-4 * DAY),
  ends_at: at(-3 * DAY),
  status: "closed",
  notice_sent_at: at(-12 * DAY),
  online: votes(["A-104", "A-202", "A-208"], at(-3 * DAY - 2 * HOUR)),
});

// M15: last year's meeting, published and archived.
await createMeeting({
  key: "M15",
  title: ["DEMO M15 · ประชุมปีที่แล้ว (เก็บถาวร)", "DEMO M15 · Last year's meeting (archived)"],
  required_approvals: 1,
  starts_at: at(-200 * DAY),
  ends_at: at(-199 * DAY),
  status: "closed",
  notice_sent_at: at(-215 * DAY),
  online: votes(
    ["A-101", "A-102", "A-103", "A-104", "A-108", "A-110", "A-201", "A-202", "A-204", "A-206", "A-208", "A-209"],
    at(-199 * DAY - 4 * HOUR),
  ),
});
