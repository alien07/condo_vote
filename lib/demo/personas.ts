// Demo personas for the local live test (docs/demo-script.md).
// Shared by the login page picker, the local bypass route, and
// scripts/seed-demo.mjs. Emails use example.test, which never receives mail.

export type DemoPersonaKey =
  | "admin"
  | "committee"
  | "ownerA"
  | "ownerB"
  | "resident"
  | "newUser";

export type DemoPersona = {
  key: DemoPersonaKey;
  email: string;
  fullName: string;
  /** What the persona is for, shown on the login picker. */
  caseLabel: string;
  language: "th" | "en";
  roles: Array<"admin" | "committee" | "system_admin">;
  defaultStatus: "owner" | "resident";
  /** false: the seed leaves no profile, so the first sign-in starts fresh. */
  seeded: boolean;
};

/** Signs in with real Google; the seed grants the roles. */
export const DEMO_SYSTEM_ADMIN = {
  email: "manorin.prajak@gmail.com",
  fullName: "System Admin (Google)",
  roles: ["admin", "committee", "system_admin"] as const,
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "admin",
    email: "admin.fix-results@example.test",
    fullName: "Demo Admin · แก้ M6/ออกผล",
    caseLabel: "Admin (not system admin) · F2, F5, F6",
    language: "th",
    roles: ["admin"],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "committee",
    email: "committee.approve@example.test",
    fullName: "Demo Committee · อนุมัติผล",
    caseLabel: "Committee (not admin) · F2, F7",
    language: "th",
    roles: ["committee"],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "ownerA",
    email: "owner.th.2rooms-proxy@example.test",
    fullName: "Owner A · TH · 2 ห้อง + รับมอบฉันทะ",
    caseLabel: "Owner A · Thai · 2 rooms + proxy · F1",
    language: "th",
    roles: [],
    defaultStatus: "owner",
    seeded: true,
  },
  {
    key: "ownerB",
    email: "owner.en.paper-conflict@example.test",
    fullName: "Owner B · EN · online + paper",
    caseLabel: "Owner B · English · online + paper vote · F3",
    language: "en",
    roles: [],
    defaultStatus: "owner",
    seeded: true,
  },
  {
    key: "resident",
    email: "resident.no-vote@example.test",
    fullName: "Resident · ไม่ใช่เจ้าของ",
    caseLabel: "Resident (not an owner) · F7",
    language: "th",
    roles: [],
    defaultStatus: "resident",
    seeded: true,
  },
  {
    key: "newUser",
    email: "new.pending-consent@example.test",
    fullName: "New user · รอ PDPA/อนุมัติ",
    caseLabel: "New user · PDPA consent + approval · F4",
    language: "th",
    roles: [],
    defaultStatus: "owner",
    seeded: false,
  },
];

export function findDemoPersona(key: string | null | undefined) {
  return DEMO_PERSONAS.find((persona) => persona.key === key) ?? null;
}
