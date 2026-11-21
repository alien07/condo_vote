// English text of a meeting (D020, demo feedback item 6b).
const en = {
  title: "English text",
  intro:
    "English next to the Thai text owners see. Translate drafts it; check and edit every line, then tick \"I checked the English\". The Thai version prevails.",
  afterPublish:
    "This meeting is published: only the English can change here, Thai stays locked, and the change is logged.",
  // Keep as it is (user decision 2026-11-21, 0050).
  keepTitle: "Keep the English as it is",
  keepText:
    "Owners who chose English already see this meeting. If the English is right, or you decide not to change it, keep it as it is: where English is missing, they see the Thai text. The decision is logged.",
  keepButton: "Keep as it is (no change)",
  keepConfirm:
    "Keep the English of this meeting as it is? Where English is missing, owners see the Thai text. This is recorded in the audit log.",
  keptAsIs: "Kept as it is. The overview no longer counts this meeting.",
  meeting: "Meeting",
  titleField: "Meeting title",
  locationField: "Venue",
  agenda: "Agenda {no}",
  agendaTitle: "Agenda title",
  question: "Question",
  legalNote: "Legal note",
  choice: "Choice",
  thai: "Thai",
  english: "English",
  translate: "Translate",
  translating: "Translating...",
  translateAll: "Translate all empty fields",
  provider: "Translation: {provider}",
  providerMock: "demo list (no outside service)",
  providerAzure: "Azure AI Translator",
  noDemo: "Lines marked [no demo translation] need English typed by hand.",
  checked: "I checked the English",
  checkedAt: "Checked {time}",
  notChecked: "Not checked yet",
  save: "Save English",
  saving: "Saving...",
  saved: "English saved",
  missing: "English missing",
  needsCheck: "English not checked",
  openEditor: "English text",
  publishBlocked:
    "This condo publishes in two languages. Fill in and check the English text of this meeting before publishing.",
  bilingualSwitch: "Bilingual documents (Thai and English)",
  bilingualHelp:
    "Meetings need English text, checked by the Manager, before publishing. Results already generated keep their text.",
  projectNameEn: "Project name (English)",
  juristicNameEn: "Juristic person name (English)",
  nextStepTitle: "Saved. Next: English.",
  nextStepText: "“{title}” needs English text, checked, before it can be published.",
  nextStepButton: "Add English",
};

const th: typeof en = {
  title: "ข้อความภาษาอังกฤษ",
  intro:
    "ภาษาอังกฤษคู่กับข้อความภาษาไทยที่เจ้าของร่วมเห็น ปุ่มแปลช่วยร่างให้ โปรดตรวจและแก้ทุกบรรทัด แล้วติ๊ก \"ตรวจภาษาอังกฤษแล้ว\" ฉบับภาษาไทยมีผลบังคับ",
  afterPublish:
    "การประชุมนี้เผยแพร่แล้ว แก้ได้เฉพาะภาษาอังกฤษ ข้อความภาษาไทยยังล็อกอยู่ และระบบบันทึกการแก้ไขไว้",
  keepTitle: "ใช้ภาษาอังกฤษตามที่เป็นอยู่",
  keepText:
    "เจ้าของร่วมที่เลือกภาษาอังกฤษเห็นการประชุมนี้อยู่แล้ว ถ้าภาษาอังกฤษถูกต้อง หรือตัดสินใจไม่แก้ ให้ใช้ตามที่เป็นอยู่ ส่วนที่ไม่มีภาษาอังกฤษจะแสดงเป็นภาษาไทย ระบบบันทึกการตัดสินใจนี้ไว้",
  keepButton: "ใช้ตามนี้ (ไม่แก้)",
  keepConfirm:
    "ใช้ภาษาอังกฤษของการประชุมนี้ตามที่เป็นอยู่? ส่วนที่ไม่มีภาษาอังกฤษ เจ้าของร่วมจะเห็นเป็นภาษาไทย ระบบบันทึกไว้ในบันทึกการใช้งาน",
  keptAsIs: "ใช้ตามที่เป็นอยู่แล้ว หน้าภาพรวมจะไม่นับการประชุมนี้อีก",
  meeting: "การประชุม",
  titleField: "ชื่อการประชุม",
  locationField: "สถานที่",
  agenda: "วาระที่ {no}",
  agendaTitle: "ชื่อวาระ",
  question: "คำถาม",
  legalNote: "หมายเหตุทางกฎหมาย",
  choice: "ตัวเลือก",
  thai: "ไทย",
  english: "อังกฤษ",
  translate: "แปล",
  translating: "กำลังแปล...",
  translateAll: "แปลทุกช่องที่ยังว่าง",
  provider: "บริการแปล: {provider}",
  providerMock: "รายการสำหรับ demo (ไม่ส่งข้อมูลออก)",
  providerAzure: "Azure AI Translator",
  noDemo: "บรรทัดที่มี [no demo translation] ต้องพิมพ์ภาษาอังกฤษเอง",
  checked: "ตรวจภาษาอังกฤษแล้ว",
  checkedAt: "ตรวจเมื่อ {time}",
  notChecked: "ยังไม่ได้ตรวจ",
  save: "บันทึกภาษาอังกฤษ",
  saving: "กำลังบันทึก...",
  saved: "บันทึกภาษาอังกฤษแล้ว",
  missing: "ยังไม่มีภาษาอังกฤษ",
  needsCheck: "ยังไม่ได้ตรวจภาษาอังกฤษ",
  openEditor: "ข้อความภาษาอังกฤษ",
  publishBlocked:
    "อาคารนี้ใช้เอกสารสองภาษา โปรดกรอกและตรวจข้อความภาษาอังกฤษของการประชุมนี้ก่อนเผยแพร่",
  bilingualSwitch: "เอกสารสองภาษา (ไทยและอังกฤษ)",
  bilingualHelp:
    "การประชุมต้องมีข้อความภาษาอังกฤษที่ผู้จัดการตรวจแล้วก่อนเผยแพร่ ผลที่สร้างไว้แล้วคงข้อความเดิม",
  projectNameEn: "ชื่อโครงการ (ภาษาอังกฤษ)",
  juristicNameEn: "ชื่อนิติบุคคล (ภาษาอังกฤษ)",
  nextStepTitle: "บันทึกแล้ว ต่อไปใส่ภาษาอังกฤษ",
  nextStepText: "“{title}” ต้องมีข้อความภาษาอังกฤษที่ตรวจแล้ว จึงจะเผยแพร่ได้",
  nextStepButton: "ใส่ภาษาอังกฤษ",
};

export const englishText = { en, th };
