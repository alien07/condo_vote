import type { Locale } from "@/lib/i18n/locales";

// Plain-language explanations of result terms (help plan). One source for the
// "i" tips on screen, the notes printed under tables in PDFs and the official
// record, and the "How to read the result table" FAQ.

export type GlossaryKey =
  | "rooms"
  | "shareOfAll"
  | "shareOfCast"
  | "rule"
  | "outcome"
  | "abstain"
  | "informational"
  | "eligibleRooms"
  | "votedRooms"
  | "votedOwnership"
  | "totalOwnership"
  | "quorum"
  | "reference"
  | "summaryVsOfficial"
  | "sha256"
  | "approvals"
  | "approveClose"
  | "ballotsCounted"
  | "bothChannels"
  | "manualBallots"
  | "trafficLog";

type Entry = { term: string; text: string };

export const GLOSSARY: Record<Locale, Record<GlossaryKey, Entry>> = {
  th: {
    rooms: {
      term: "ห้อง",
      text: "จำนวนห้องที่เลือกตัวเลือกนี้ หนึ่งห้องนับหนึ่ง ไม่ว่าจะลงออนไลน์หรือบัตรกระดาษ",
    },
    shareOfAll: {
      term: "% ของทั้งอาคาร",
      text: "คะแนนเสียง (อัตราส่วนกรรมสิทธิ์) ของห้องที่เลือกตัวเลือกนี้ เทียบกับทุกห้องในอาคารรวมกัน (100%) ใช้กับเกณฑ์แบบ \"ของคะแนนเสียงทั้งหมด\" เช่น 3 ใน 4 ของทั้งหมด",
    },
    shareOfCast: {
      term: "% ของผู้ลงคะแนน",
      text: "เทียบกับคะแนนเสียงของห้องที่มาลงคะแนนเท่านั้น รวมห้องที่งดออกเสียง ห้องที่ไม่มาลงคะแนนไม่นับ ใช้กับเกณฑ์แบบ \"ของห้องที่ลงคะแนน\"",
    },
    rule: {
      term: "เกณฑ์",
      text: "เงื่อนไขที่ตัวเลือกต้องผ่านจึงจะเป็นมติ คอลัมน์ที่มีป้าย \"ใช้ตัดสินวาระนี้\" คือคอลัมน์ที่ใช้เทียบกับเกณฑ์",
    },
    outcome: {
      term: "มีมติ / ไม่มีมติ",
      text: "\"มีมติ\" คือมีตัวเลือกผ่านเกณฑ์ \"ไม่มีมติ\" คือไม่มีตัวเลือกใดผ่านเกณฑ์ แม้จะได้คะแนนมากที่สุดก็ตาม",
    },
    abstain: {
      term: "งดออกเสียง",
      text: "ห้องมาลงคะแนนแต่ไม่เลือกข้างใด นับเป็นห้องที่ลงคะแนน จึงทำให้ผ่านเกณฑ์แบบ \"ของห้องที่ลงคะแนน\" ยากขึ้น",
    },
    informational: {
      term: "แจ้งเพื่อทราบ",
      text: "วาระที่ไม่มีการตัดสิน ไม่มีเกณฑ์ผ่าน",
    },
    eligibleRooms: {
      term: "ห้องที่มีสิทธิ์",
      text: "ห้องที่มีสิทธิ์ลงคะแนนในการประชุมนี้ ตามรายชื่อที่บันทึกไว้เมื่อเผยแพร่การประชุม",
    },
    votedRooms: {
      term: "ห้องที่ลงคะแนน",
      text: "ห้องที่มีบัตรถูกนับ ทั้งออนไลน์และบัตรกระดาษ ห้องละหนึ่งใบ",
    },
    votedOwnership: {
      term: "คะแนนเสียงที่ลงคะแนน",
      text: "อัตราส่วนกรรมสิทธิ์รวมของห้องที่ลงคะแนน ใช้ดูว่าครบองค์ประชุมหรือไม่",
    },
    totalOwnership: {
      term: "คะแนนเสียงรวม",
      text: "อัตราส่วนกรรมสิทธิ์รวมของห้องที่มีสิทธิ์ทั้งหมด ปกติเท่ากับ 100%",
    },
    quorum: {
      term: "องค์ประชุม",
      text: "คะแนนเสียงขั้นต่ำที่ต้องมาลงคะแนน การประชุมจึงมีผล เช่น ไม่น้อยกว่า 1 ใน 4 ของทั้งหมด การประชุมครั้งที่สองไม่บังคับองค์ประชุม",
    },
    reference: {
      term: "เลขอ้างอิง",
      text: "รหัสของผลชุดนี้ ใช้ตรวจว่าเอกสารที่ได้รับตรงกับผลที่ระบบเก็บไว้",
    },
    summaryVsOfficial: {
      term: "ฉบับสรุป / ฉบับทางการ",
      text: "ฉบับสรุปคือหน้าที่เห็นอยู่นี้ ฉบับทางการคือบันทึกผลการลงมติที่นิติบุคคลเก็บไว้ ขอดูได้ที่สำนักงานนิติบุคคล",
    },
    sha256: {
      term: "SHA-256",
      text: "ลายนิ้วมือของข้อมูลผล ถ้าข้อมูลเปลี่ยนแม้ตัวเดียว ค่านี้จะเปลี่ยนทั้งหมด",
    },
    approvals: {
      term: "อนุมัติแล้ว",
      text: "ผลจะเผยแพร่เมื่อกรรมการอนุมัติครบตามจำนวนที่การประชุมกำหนด กรรมการแต่ละคนอนุมัติได้ครั้งเดียว",
    },
    approveClose: {
      term: "อนุมัติปิดลงคะแนน",
      text: "ปิดลงคะแนนก่อนเวลาที่กำหนด เมื่อกรรมการอนุมัติครบจำนวน ถ้าไม่มีใครอนุมัติ ระบบปิดเองตามเวลา",
    },
    ballotsCounted: {
      term: "บัตรที่นับ",
      text: "จำนวนห้องที่มีบัตรถูกนับ เทียบกับห้องที่มีสิทธิ์ทั้งหมด",
    },
    bothChannels: {
      term: "ห้องที่มีทั้งสองช่องทาง",
      text: "ห้องที่ลงทั้งออนไลน์และบัตรกระดาษ นิติบุคคลเลือกใช้ใบเดียวพร้อมบันทึกเหตุผล",
    },
    manualBallots: {
      term: "บัตรกระดาษ/บันทึกโดยผู้ดูแล",
      text: "บัตรกระดาษที่ผู้ดูแลกรอกเข้าระบบ ระบบบันทึกผู้กรอกและเวลาไว้ตรวจสอบ",
    },
    trafficLog: {
      term: "ข้อมูลจราจรอิเล็กทรอนิกส์ (log)",
      text: "บันทึกการเข้าใช้ระบบระหว่างการประชุม เก็บไว้เป็นหลักฐาน",
    },
  },
  en: {
    rooms: {
      term: "Rooms",
      text: "Number of rooms that chose this option. Each room counts once, online or on paper.",
    },
    shareOfAll: {
      term: "Of all ownership",
      text: "Ownership share of the rooms that chose this option, out of all rooms in the building (100%). Used by rules \"of total ownership\", such as 3/4 of all.",
    },
    shareOfCast: {
      term: "Of votes cast",
      text: "Out of the ownership of rooms that voted only, including rooms that abstained. Rooms that did not vote are left out. Used by rules \"of rooms that voted\".",
    },
    rule: {
      term: "Rule",
      text: "What an option needs to pass. The column marked \"Decides this item\" is the one compared with the rule.",
    },
    outcome: {
      term: "Resolved / No resolution",
      text: "\"Resolved\" means an option met the rule. \"No resolution\" means no option did, even the one with the most votes.",
    },
    abstain: {
      term: "Abstain",
      text: "The room voted but chose no side. It counts as a room that voted, so it makes rules \"of rooms that voted\" harder to meet.",
    },
    informational: {
      term: "For information",
      text: "An item for information only, with no pass rule.",
    },
    eligibleRooms: {
      term: "Eligible rooms",
      text: "Rooms with a vote in this meeting, as listed when the meeting was published.",
    },
    votedRooms: {
      term: "Rooms that voted",
      text: "Rooms with a counted ballot, online or on paper, one per room.",
    },
    votedOwnership: {
      term: "Ownership that voted",
      text: "Total ownership share of the rooms that voted. Used to check the quorum.",
    },
    totalOwnership: {
      term: "Total ownership",
      text: "Total ownership share of all eligible rooms, normally 100%.",
    },
    quorum: {
      term: "Quorum",
      text: "The minimum ownership that must vote for the meeting to count, such as at least 1/4 of all. A second (reconvened) meeting needs no quorum.",
    },
    reference: {
      term: "Reference",
      text: "The ID of this result. Use it to check that a document matches the result the system keeps.",
    },
    summaryVsOfficial: {
      term: "Summary / official record",
      text: "The summary is this page. The official record is the result record kept by the juristic person office; ask the office to see it.",
    },
    sha256: {
      term: "SHA-256",
      text: "A fingerprint of the result data. If even one character changes, this value changes completely.",
    },
    approvals: {
      term: "Approvals",
      text: "The result is published when the number of committee approvals set for the meeting is reached. Each member approves once.",
    },
    approveClose: {
      term: "Approve closing voting",
      text: "Closes voting before the set time once enough committee members approve. Without approvals, voting closes on time by itself.",
    },
    ballotsCounted: {
      term: "Ballots counted",
      text: "Rooms with a counted ballot, out of all eligible rooms.",
    },
    bothChannels: {
      term: "Rooms on both channels",
      text: "Rooms that voted online and on paper. The office chose one ballot and recorded why.",
    },
    manualBallots: {
      term: "Paper ballots entered by staff",
      text: "Paper ballots typed in by an admin; the system records who entered them and when.",
    },
    trafficLog: {
      term: "Traffic log",
      text: "Record of system access during the meeting, kept as evidence.",
    },
  },
};

export function glossary(locale: Locale, key: GlossaryKey): Entry {
  return GLOSSARY[locale][key];
}

export const GLOSSARY_UI: Record<Locale, { about: string; decides: string }> = {
  th: { about: "คำอธิบาย", decides: "ใช้ตัดสินวาระนี้" },
  en: { about: "What this means", decides: "Decides this item" },
};

/** The result column a pass rule compares against, if any. */
export function decidingColumn(basis: string | null | undefined) {
  if (basis === "total_ownership") {
    return "shareOfAll" as const;
  }

  if (basis === "voting_ownership") {
    return "shareOfCast" as const;
  }

  return null;
}
