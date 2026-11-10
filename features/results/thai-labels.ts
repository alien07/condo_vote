// Thai wording for the result documents (official record and owner summary).
// The app UI stays in English for now; documents for Thai authorities and
// owners are in Thai.

type RuleLike = { basis?: string; operator?: string; percent?: number } | null | undefined;

function percent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

export function thaiPassRule(rule: RuleLike) {
  if (!rule || rule.basis === "none" || rule.percent === undefined) {
    return "วาระแจ้งเพื่อทราบ ไม่มีเกณฑ์ผ่าน";
  }

  const operator = rule.operator === "gte" ? "ไม่น้อยกว่า" : "เกินกว่า";
  const basis =
    rule.basis === "total_ownership"
      ? "ของคะแนนเสียงเจ้าของร่วมทั้งหมด (อัตราส่วนกรรมสิทธิ์รวม)"
      : "ของคะแนนเสียงของห้องที่ลงคะแนน";

  return `${operator} ${percent(rule.percent)} ${basis}`;
}

export function thaiOutcome(outcome: string | null | undefined, decidedChoices: string[]) {
  if (outcome === "decided") {
    return `มีมติ: ${decidedChoices.join(", ")}`;
  }

  if (outcome === "not_decided") {
    return "ไม่มีมติ: ไม่มีตัวเลือกใดผ่านเกณฑ์";
  }

  if (outcome === "informational") {
    return "แจ้งเพื่อทราบ";
  }

  return "-";
}

export function thaiQuorum(quorum: { required_percent?: number | null; met?: boolean | null } | null | undefined) {
  if (!quorum || quorum.required_percent === undefined || quorum.required_percent === null) {
    return "-";
  }

  const rule =
    quorum.required_percent === 0
      ? "การประชุมครั้งใหม่ ไม่บังคับองค์ประชุม"
      : `ไม่น้อยกว่า ${percent(quorum.required_percent)} ของคะแนนเสียงทั้งหมด`;
  const result = quorum.met === null ? "" : quorum.met ? " — ครบองค์ประชุม" : " — ไม่ครบองค์ประชุม";

  return `${rule}${result}`;
}

export const THAI_RESOLUTION_TYPES: Record<string, string> = {
  ordinary: "มติทั่วไป",
  special: "มติพิเศษ",
  informational: "เพื่อทราบ",
};

export const THAI_MEETING_TYPES: Record<string, string> = {
  agm: "การประชุมใหญ่สามัญประจำปี",
  egm: "การประชุมใหญ่วิสามัญ",
  online_vote: "การลงมติออนไลน์",
  committee: "การประชุมคณะกรรมการ",
};

export const THAI_MEETING_ROUNDS: Record<string, string> = {
  first: "การประชุมครั้งแรก",
  reconvened: "การประชุมครั้งใหม่ (ครั้งแรกไม่ครบองค์ประชุม)",
};

export const THAI_SIGNATORIES: Record<string, string> = {
  chairperson: "ประธานที่ประชุม",
  manager: "ผู้จัดการนิติบุคคลอาคารชุด",
  minutes_taker: "ผู้บันทึกการประชุม",
  committee_member: "กรรมการ",
};

export function thaiBallotSecrecy(value: string | null | undefined) {
  return value === "secret" ? "ลงคะแนนลับ" : "ลงคะแนนโดยเปิดเผย";
}
