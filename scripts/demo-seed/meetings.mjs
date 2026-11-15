// Demo meetings M1-M13 (see docs/demo-script.md).

import { MINUTE, HOUR, DAY, at } from "./context.mjs";
import {
  AGREE_DISAGREE,
  STANDARD_QUESTIONS,
  createMeeting,
  votes,
} from "./meeting-builder.mjs";

console.log("[demo:seed] meetings ...");

// M1: meeting-day voting open. Owner A: 2 own rooms + A-103 by proxy;
// A-105 and A-106 proxies are pending, so a 4th proxy hits the limit.
await createMeeting({
  key: "M1",
  title: "DEMO M1 · ประชุมใหญ่สามัญ 2569 (เปิดโหวตวันประชุม)",
  meeting_number: "1/2569",
  starts_at: at(-HOUR),
  ends_at: at(3 * DAY),
  status: "published",
  notice_sent_at: at(-15 * DAY),
  proxies: [
    { room: "A-103", status: "approved", document: true },
    { room: "A-105", status: "pending" },
    { room: "A-106", status: "pending" },
  ],
  online: votes(["A-104", "A-108", "A-110", "A-202", "A-204", "A-206", "A-207", "A-209"], at(-30 * MINUTE)),
});

// M2: advance voting window open now; meeting day in 5 days.
await createMeeting({
  key: "M2",
  title: "DEMO M2 · ลงคะแนนล่วงหน้า (เปิดอยู่)",
  starts_at: at(5 * DAY),
  ends_at: at(5 * DAY + 4 * HOUR),
  advance_starts_at: at(-DAY),
  advance_ends_at: at(2 * DAY),
  status: "published",
  notice_sent_at: at(-10 * DAY),
  online: votes(["A-104", "A-202", "A-203"], at(-2 * HOUR)),
});

// M3: between the advance window and the meeting day: closed for now.
await createMeeting({
  key: "M3",
  title: "DEMO M3 · ระหว่างโหวตล่วงหน้ากับวันประชุม (ยังโหวตไม่ได้)",
  starts_at: at(2 * DAY),
  ends_at: at(2 * DAY + 4 * HOUR),
  advance_starts_at: at(-3 * DAY),
  advance_ends_at: at(-DAY),
  status: "published",
  notice_sent_at: at(-14 * DAY),
  online: votes(["A-108", "A-206"], at(-2 * DAY)),
});

// M4: secret ballot, open; Owner A also votes A-103 as proxy.
await createMeeting({
  key: "M4",
  title: "DEMO M4 · ลงคะแนนลับ (เปิดอยู่)",
  meeting_type: "egm",
  starts_at: at(-2 * HOUR),
  ends_at: at(2 * DAY),
  ballot_secrecy: "secret",
  status: "published",
  notice_sent_at: at(-14 * DAY),
  proxies: [{ room: "A-103", status: "approved" }],
  questions: [
    {
      agenda_no: "1",
      agenda_title: "ถอดถอนผู้จัดการ",
      question_text: "เห็นควรถอดถอนผู้จัดการนิติบุคคลหรือไม่ (ลงคะแนนลับ)",
      question_type: "single_choice",
      required_threshold: "half_total",
      choices: AGREE_DISAGREE,
    },
  ],
  online: votes(["A-110", "A-204", "A-208"], at(-HOUR)),
});

// M5: draft with each pass rule type and a land office question.
await createMeeting({
  key: "M5",
  title: "DEMO M5 · ร่างการประชุม (กฎผ่านมติ 4 แบบ)",
  meeting_type: "egm",
  starts_at: at(20 * DAY),
  ends_at: at(20 * DAY + 4 * HOUR),
  status: "draft",
  questions: [
    { agenda_no: "1", agenda_title: "เกินกึ่งหนึ่งของผู้ลงคะแนน", question_text: "อนุมัติแผนซ่อมสระว่ายน้ำ", question_type: "single_choice", required_threshold: "majority_submitted", choices: AGREE_DISAGREE },
    { agenda_no: "2", agenda_title: "เกินกึ่งหนึ่งของทั้งหมด", question_text: "ปรับอัตราค่าส่วนกลาง", question_type: "single_choice", required_threshold: "half_total", choices: AGREE_DISAGREE },
    { agenda_no: "3", agenda_title: "3 ใน 4 ของทั้งหมด", question_text: "แก้ไขข้อบังคับนิติบุคคลอาคารชุด", question_type: "single_choice", required_threshold: "three_fourths_total", land_office: true, legal_note: "ต้องจดทะเบียนต่อสำนักงานที่ดิน", choices: AGREE_DISAGREE },
    { agenda_no: "4", agenda_title: "แจ้งเพื่อทราบ", question_text: "รับทราบรายงานผลการดำเนินงาน", question_type: "single_choice", required_threshold: "informational", choices: ["รับทราบ"] },
  ],
});

// M6: voting ended. Owner B voted online AND on paper (conflict), and
// A-205's paper ballot has an unconfirmed identity. Quorum not met.
await createMeeting({
  key: "M6",
  title: "DEMO M6 · ปิดโหวตแล้ว (ต้องแก้ก่อนออกผล)",
  meeting_type: "egm",
  starts_at: at(-2 * DAY),
  ends_at: at(-DAY),
  status: "closed",
  notice_sent_at: at(-16 * DAY),
  online: [
    ...votes(["A-201"], at(-DAY - 3 * HOUR), (n, qs) => qs.map(() => [0])),
    ...votes(["A-202", "A-109"], at(-DAY - 2 * HOUR)),
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

// M7: result generated, 1 of 2 committee approvals.
await createMeeting({
  key: "M7",
  title: "DEMO M7 · ออกผลแล้ว รออนุมัติ (1/2)",
  meeting_type: "egm",
  starts_at: at(-8 * DAY),
  ends_at: at(-7 * DAY),
  status: "closed",
  notice_sent_at: at(-22 * DAY),
  online: votes(
    ["A-101", "A-103", "A-104", "A-106", "A-108", "A-110", "A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-210"],
    at(-7 * DAY - 5 * HOUR),
  ),
});

// M11-M13: test cases for "1. Approve results" on the Committee page
// (review 2026-11-15). Same voters as M7.
export const m7Voters = ["A-101", "A-103", "A-104", "A-106", "A-108", "A-110", "A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-210"];
for (const [key, title, daysAgo, required] of [
  // Nobody has approved: approve, or request a correction.
  ["M11", "DEMO M11 · ออกผลแล้ว ยังไม่มีใครอนุมัติ (0/2)", 6, 2],
  // An open correction request: approving counts, publishing waits (needs 1).
  ["M12", "DEMO M12 · มีคำขอแก้ไขรอผู้ดูแลตอบ", 5, 1],
  // Generated again after a wording correction: approvals start again.
  ["M13", "DEMO M13 · สร้างผลใหม่หลังแก้ไข", 4, 2],
]) {
  await createMeeting({
    key,
    title,
    meeting_type: "egm",
    starts_at: at(-(daysAgo + 1) * DAY),
    ends_at: at(-daysAgo * DAY),
    status: "closed",
    notice_sent_at: at(-(daysAgo + 15) * DAY),
    required_approvals: required,
    online: votes(m7Voters, at(-daysAgo * DAY - 5 * HOUR)),
  });
}

// M8: published with the full meeting record. Q1 decided; Q2 needs 75% of
// total ownership and is not decided.
await createMeeting({
  key: "M8",
  title: "DEMO M8 · เผยแพร่ผลแล้ว (บันทึกการประชุมครบ)",
  meeting_type: "egm",
  meeting_number: "2/2569",
  starts_at: at(-14 * DAY - 3 * HOUR),
  ends_at: at(-14 * DAY),
  advance_starts_at: at(-17 * DAY),
  advance_ends_at: at(-15 * DAY),
  status: "closed",
  notice_sent_at: at(-30 * DAY),
  identity_method: "เข้าสู่ระบบด้วย Google และเทียบอีเมลกับทะเบียนเจ้าของร่วม",
  recording_reference: "DEMO/recordings/M8.mp4",
  traffic_log_reference: "DEMO/logs/M8-traffic.csv",
  questions: [
    STANDARD_QUESTIONS[0],
    {
      agenda_no: "2",
      agenda_title: "แก้ไขข้อบังคับ",
      question_text: "แก้ไขข้อบังคับเรื่องการเลี้ยงสัตว์",
      question_type: "single_choice",
      required_threshold: "three_fourths_total",
      land_office: true,
      legal_note: "ต้องจดทะเบียนต่อสำนักงานที่ดิน",
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

// M9: reconvened meeting, no quorum required; published.
await createMeeting({
  key: "M9",
  title: "DEMO M9 · ประชุมครั้งที่สอง (ไม่ต้องครบองค์ประชุม)",
  meeting_round: "reconvened",
  quorum_rule: "not_required_second_call",
  required_approvals: 1,
  starts_at: at(-3 * DAY),
  ends_at: at(-2 * DAY),
  status: "closed",
  notice_sent_at: at(-10 * DAY),
  online: votes(["A-104", "A-202", "A-208"], at(-2 * DAY - 2 * HOUR)),
});

// M10: last year's meeting, published and archived.
await createMeeting({
  key: "M10",
  title: "DEMO M10 · ประชุมปีที่แล้ว (เก็บถาวร)",
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
