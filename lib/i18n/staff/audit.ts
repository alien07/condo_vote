// Read-only audit page (demo feedback item 14b).
const en = {
  title: "Audit",
  intro: "Read only. Published results with their official records, correction requests, and the latest audit log entries.",
  results: "Published results",
  officialRecord: "Official record",
  corrections: "Correction requests",
  log: "Latest audit log entries",
  time: "Time",
  actor: "Who",
  action: "Action",
  entity: "Record",
  none: "Nothing yet.",
};

const th: typeof en = {
  title: "ตรวจสอบ",
  intro: "อ่านอย่างเดียว ผลที่ประกาศแล้วพร้อมเอกสารทางการ คำขอแก้ไขผล และบันทึกการใช้งานล่าสุด",
  results: "ผลที่ประกาศแล้ว",
  officialRecord: "เอกสารทางการ",
  corrections: "คำขอแก้ไขผล",
  log: "บันทึกการใช้งานล่าสุด",
  time: "เวลา",
  actor: "ผู้ทำ",
  action: "การกระทำ",
  entity: "รายการ",
  none: "ยังไม่มี",
};

export const auditText = { en, th };
