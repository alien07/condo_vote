// Fixed English for Thai legal and meeting terms (demo feedback item 6b), so
// machine drafts use the same words as the rest of the app. Longer terms come
// first so they win over shorter ones inside them.
export const TRANSLATION_GLOSSARY: ReadonlyArray<readonly [string, string]> = [
  ["นิติบุคคลอาคารชุด", "condominium juristic person"],
  ["ผู้จัดการนิติบุคคล", "juristic person manager"],
  ["ข้อบังคับนิติบุคคลอาคารชุด", "condominium by-laws"],
  ["ข้อบังคับ", "by-laws"],
  ["ประชุมใหญ่สามัญประจำปี", "annual general meeting"],
  ["ประชุมใหญ่สามัญ", "annual general meeting"],
  ["ประชุมใหญ่วิสามัญ", "extraordinary general meeting"],
  ["เจ้าของร่วม", "co-owners"],
  ["คณะกรรมการ", "committee"],
  ["กรรมการ", "committee member"],
  ["ค่าส่วนกลาง", "common fee"],
  ["ทรัพย์ส่วนกลาง", "common property"],
  ["อัตราส่วนกรรมสิทธิ์", "ownership share"],
  ["สำนักงานที่ดิน", "Land Office"],
  ["งบการเงิน", "financial statements"],
  ["องค์ประชุม", "quorum"],
  ["มอบฉันทะ", "proxy"],
  ["งดออกเสียง", "abstain"],
];

/** Thai person names are transliterated, not translated: "คุณ" becomes "Khun". */
export const NAME_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["คุณ", "Khun "],
  ["นาย", "Mr. "],
  ["นางสาว", "Ms. "],
  ["นาง", "Mrs. "],
];
