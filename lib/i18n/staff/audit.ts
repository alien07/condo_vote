// Read-only audit page (demo feedback item 14b; tabs, search and words
// req_0007).
const en = {
  title: "Audit",
  intro:
    "Read only. Find the evidence for a meeting: published results with their official records, correction requests and the activity log.",
  tabsTitle: "Audit sections",
  tabs: {
    results: "Published results",
    corrections: "Correction requests",
    log: "Activity log",
  } as Record<string, string>,
  tabCount: "{count} items",
  meeting: "Meeting",
  meetingFilter: "Pick a meeting to see only its results, correction requests and activity.",
  resultsFilter: "Filter published results by publication date.",
  correctionsFilter: "Filter correction requests by the date they were sent.",
  from: "From",
  to: "To",
  approvedBy: "Approved by {count}",
  approvedOf: "Approved by {count} of {members} members (needed {required})",
  castingVote: "Decided by the chair's deciding vote",
  publishedAt: "Published {date}",
  officialRecord: "View record (web page)",
  officialPdf: "Download official PDF",
  requestedBy: "Asked by {name} · {date}",
  category: "Category",
  level: "Level",
  status: "Status",
  reason: "Reason",
  answer: "Answer",
  answeredAt: "Answered {date}",
  none: "Nothing matches.",
};

const th: typeof en = {
  title: "ตรวจสอบ",
  intro:
    "อ่านอย่างเดียว หาหลักฐานของการประชุม: ผลที่ประกาศแล้วพร้อมบันทึกทางการ คำขอแก้ไขผล และบันทึกการใช้งาน",
  tabsTitle: "หมวดการตรวจสอบ",
  tabs: {
    results: "ผลที่ประกาศแล้ว",
    corrections: "คำขอแก้ไขผล",
    log: "บันทึกการใช้งาน",
  } as Record<string, string>,
  tabCount: "{count} รายการ",
  meeting: "การประชุม",
  meetingFilter: "เลือกการประชุมเพื่อดูเฉพาะผล คำขอแก้ไข และบันทึกการใช้งานของการประชุมนั้น",
  resultsFilter: "ค้นหาผลที่ประกาศแล้วตามวันที่ประกาศ",
  correctionsFilter: "ค้นหาคำขอแก้ไขผลตามวันที่ส่งคำขอ",
  from: "ตั้งแต่",
  to: "ถึง",
  approvedBy: "อนุมัติ {count} คน",
  approvedOf: "อนุมัติ {count} จากกรรมการ {members} คน (ต้องการ {required} คน)",
  castingVote: "ประธานลงคะแนนชี้ขาด",
  publishedAt: "ประกาศ {date}",
  officialRecord: "ดูบันทึกผล (หน้าเว็บ)",
  officialPdf: "ดาวน์โหลด PDF ฉบับทางการ",
  requestedBy: "ขอโดย {name} · {date}",
  category: "ประเภท",
  level: "ระดับ",
  status: "สถานะ",
  reason: "เหตุผล",
  answer: "คำตอบ",
  answeredAt: "ตอบเมื่อ {date}",
  none: "ไม่พบรายการที่ตรงกัน",
};

export const auditText = { en, th };
