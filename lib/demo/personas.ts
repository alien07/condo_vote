// Demo personas for the local live test (docs/demo-script.md, req_0010).
// Shared by the login page picker, the local bypass route, and
// scripts/seed-demo.mjs. Emails use example.test, which never receives mail.

export type DemoPersonaKey =
  | "manager"
  | "staff"
  | "auditor"
  | "systemAdmin"
  | "chair"
  | "viceChair"
  | "member"
  | "ownerTh"
  | "ownerEn"
  | "ownerCo"
  | "coOwner"
  | "resident"
  | "proxyHolder"
  | "newUser";

export type DemoRole = "admin" | "staff" | "auditor" | "committee" | "system_admin";

/** Login picker groups, in this order. */
export type DemoGroup = "office" | "committee" | "owners" | "platform";

export const DEMO_GROUPS: Record<DemoGroup, { th: string; en: string }> = {
  office: { th: "งานนิติบุคคล", en: "Building office" },
  committee: { th: "คณะกรรมการ", en: "Committee" },
  owners: { th: "เจ้าของร่วมและผู้อยู่อาศัย", en: "Owners and residents" },
  platform: { th: "ผู้ดูแลระบบ", en: "System" },
};

export type DemoPersona = {
  key: DemoPersonaKey;
  group: DemoGroup;
  email: string;
  fullName: string;
  /** What the persona is for, shown on the login picker. */
  caseLabel: { th: string; en: string };
  language: "th" | "en";
  roles: DemoRole[];
  defaultStatus: "owner" | "resident" | "proxy";
  /** Committee position (D026) when a member. */
  position?: "chair" | "vice_chair" | "member";
  /** false: the seed leaves no profile, so the first sign-in starts fresh. */
  seeded: boolean;
};

/**
 * Signs in with real Google; the seed grants only system_admin (D027 B).
 * The email is personal data, so it is not in the repository: the seed reads
 * DEMO_GOOGLE_ADMIN_EMAIL from .env.local and skips this account without it.
 */
export const DEMO_SYSTEM_ADMIN = {
  envKey: "DEMO_GOOGLE_ADMIN_EMAIL",
  fullName: "System Admin (Google)",
  roles: ["system_admin"] as const,
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "manager",
    group: "office",
    email: "manager@example.test",
    fullName: "คุณมานพ ผู้จัดการ (Manager)",
    caseLabel: { th: "ผู้จัดการ: ประชุม ผล คำขอแก้ไข", en: "Manager: meetings, results, corrections" },
    language: "th",
    roles: ["admin"],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "staff",
    group: "office",
    email: "staff@example.test",
    fullName: "คุณสมศรี เจ้าหน้าที่ (Staff)",
    caseLabel: { th: "เจ้าหน้าที่: ห้อง เจ้าของ บัตรกระดาษ", en: "Office staff: rooms, owners, paper ballots" },
    language: "th",
    roles: ["staff"],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "auditor",
    group: "office",
    email: "auditor@example.test",
    fullName: "Audrey Auditor",
    caseLabel: { th: "ผู้ตรวจสอบ: อ่านอย่างเดียว (English)", en: "Auditor: read only (English)" },
    language: "en",
    roles: ["auditor"],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "chair",
    group: "committee",
    email: "chair@example.test",
    fullName: "คุณประพันธ์ ประธานกรรมการ",
    caseLabel: { th: "ประธาน: อนุมัติ และชี้ขาดเมื่อคะแนนเท่ากัน", en: "Chair: approves, breaks a tie" },
    language: "th",
    roles: ["committee"],
    defaultStatus: "owner",
    position: "chair",
    seeded: true,
  },
  {
    key: "viceChair",
    group: "committee",
    email: "vice.chair@example.test",
    fullName: "คุณวิไล รองประธาน",
    caseLabel: { th: "รองประธาน: อนุมัติหรือไม่อนุมัติ", en: "Vice chair: approve or not" },
    language: "th",
    roles: ["committee"],
    defaultStatus: "owner",
    position: "vice_chair",
    seeded: true,
  },
  {
    key: "member",
    group: "committee",
    email: "member@example.test",
    fullName: "Mark Member",
    caseLabel: { th: "กรรมการ (English): ยังไม่ได้ตอบบางผล", en: "Member (English): some results still to answer" },
    language: "en",
    roles: ["committee"],
    defaultStatus: "owner",
    position: "member",
    seeded: true,
  },
  {
    key: "ownerTh",
    group: "owners",
    email: "owner.th@example.test",
    fullName: "คุณอนันต์ เจ้าของ 2 ห้อง",
    caseLabel: { th: "เจ้าของ 2 ห้อง + รับมอบฉันทะ (ไทย)", en: "Owner, 2 rooms + proxy (Thai)" },
    language: "th",
    roles: [],
    defaultStatus: "owner",
    seeded: true,
  },
  {
    key: "ownerEn",
    group: "owners",
    email: "owner.en@example.test",
    fullName: "Emma English",
    caseLabel: { th: "เจ้าของ ใช้ภาษาอังกฤษ ลงคะแนนออนไลน์และกระดาษ", en: "Owner in English, online and paper vote" },
    language: "en",
    roles: [],
    defaultStatus: "owner",
    seeded: true,
  },
  {
    key: "ownerCo",
    group: "owners",
    email: "owner.co@example.test",
    fullName: "คุณชัยวัฒน์ เจ้าของร่วมหลัก",
    caseLabel: { th: "เจ้าของที่ให้ผู้ถือกรรมสิทธิ์ร่วมลงคะแนนแทน", en: "Owner who lets a co-owner vote" },
    language: "th",
    roles: [],
    defaultStatus: "owner",
    seeded: true,
  },
  {
    key: "coOwner",
    group: "owners",
    email: "co.owner@example.test",
    fullName: "คุณชลธิชา ผู้ถือกรรมสิทธิ์ร่วม",
    caseLabel: { th: "ผู้ถือกรรมสิทธิ์ร่วม: ลงคะแนนแทนเจ้าของ", en: "Co-owner: votes for the owner" },
    language: "th",
    roles: [],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "resident",
    group: "owners",
    email: "resident@example.test",
    fullName: "คุณรัตนา ผู้อยู่อาศัย",
    caseLabel: { th: "ผู้อยู่อาศัย (ไม่ใช่เจ้าของ): ดูผลได้ ลงคะแนนไม่ได้", en: "Resident (not an owner): results only" },
    language: "th",
    roles: [],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "proxyHolder",
    group: "owners",
    email: "proxy.holder@example.test",
    fullName: "Peter Proxy",
    caseLabel: { th: "ผู้รับมอบฉันทะภายนอก (English)", en: "External proxy holder (English)" },
    language: "en",
    roles: [],
    defaultStatus: "proxy",
    seeded: true,
  },
  {
    key: "newUser",
    group: "owners",
    email: "new.user@example.test",
    fullName: "คุณนภา ผู้ใช้ใหม่",
    caseLabel: { th: "ผู้ใช้ใหม่: ยอมรับ PDPA แล้วรออนุมัติ", en: "New user: PDPA consent, then waits for approval" },
    language: "th",
    roles: [],
    defaultStatus: "owner",
    seeded: false,
  },
  {
    key: "systemAdmin",
    group: "platform",
    email: "system.admin@example.test",
    fullName: "System Admin (Demo)",
    caseLabel: { th: "ผู้ดูแลระบบ: ไม่มีสิทธิ์ในงานอาคาร", en: "System Admin: no building rights" },
    language: "en",
    roles: ["system_admin"],
    // A platform account: no member access of its own (D027 B).
    defaultStatus: "proxy",
    seeded: true,
  },
];

export function findDemoPersona(key: string | null | undefined) {
  return DEMO_PERSONAS.find((persona) => persona.key === key) ?? null;
}

export function demoPersona(key: DemoPersonaKey) {
  return DEMO_PERSONAS.find((persona) => persona.key === key)!;
}
