import type { Locale } from "@/lib/i18n/locales";
import { committeeGuide } from "@/lib/help/committee-guide";
import { ownerGuide } from "@/lib/help/owner-guide";
import type { HelpGuide } from "@/lib/help/types";

// Guides published in the app, one per group of readers. The office staff
// guide waits until the admin screens are reviewed; see docs/help-outline.md.
const GUIDES = [ownerGuide, committeeGuide];

/** The release the guides were checked against. */
export const HELP_CHECKED_FOR = "v0.1 (2026-11-14)";

export function listGuides(locale: Locale): HelpGuide[] {
  return GUIDES.map((guide) => guide[locale]);
}

export function findGuide(slug: string, locale: Locale): HelpGuide | null {
  return GUIDES.find((guide) => guide[locale].slug === slug)?.[locale] ?? null;
}

/** Page text around the guides. */
export const HELP_TEXT = {
  th: {
    title: "ช่วยเหลือ",
    intro: "คู่มือการใช้งาน condoVotes",
    for: "สำหรับ",
    open: "อ่านคู่มือ",
    steps: "ขั้นตอน",
    faq: "คำถามที่พบบ่อย",
    pdf: "ดาวน์โหลดคู่มือฉบับย่อ (PDF)",
    signIn: "ไปหน้าเข้าสู่ระบบ",
    allGuides: "คู่มือทั้งหมด",
    checkedFor: (version: string) => `ตรวจกับระบบเวอร์ชัน ${version}`,
    screenshotNote: "ภาพตัวอย่างจากข้อมูลทดสอบ หน้าจอจริงอาจมีชื่อการประชุมต่างกัน",
    comingSoon: "คู่มือสำหรับเจ้าหน้าที่นิติบุคคลและการติดตั้งระบบ จะเพิ่มเร็ว ๆ นี้",
    enlarge: "ขยาย",
    back: "กลับไปหน้าเดิม",
    home: "หน้าหลัก",
    close: "ปิด",
  },
  en: {
    title: "Help",
    intro: "condoVotes user guides",
    for: "For",
    open: "Read the guide",
    steps: "Steps",
    faq: "Frequently asked questions",
    pdf: "Download the quick guide (PDF)",
    signIn: "Go to sign in",
    allGuides: "All guides",
    checkedFor: (version: string) => `Checked against version ${version}`,
    screenshotNote: "Screenshots use test data; your meeting names will differ.",
    comingSoon: "Guides for office staff and system setup are coming soon.",
    enlarge: "Enlarge",
    back: "Back to where you were",
    home: "Home",
    close: "Close",
  },
} satisfies Record<Locale, Record<string, unknown>>;

/** Help page for an app path, for the "?" button in the header. */
export function helpHrefForPath(pathname: string) {
  if (pathname.startsWith("/vote")) {
    return pathname === "/vote" ? "/help/owner#choose" : "/help/owner#vote";
  }

  if (pathname.startsWith("/summary") || pathname.startsWith("/verify")) {
    return "/help/owner#results";
  }

  if (pathname.startsWith("/committee")) {
    return "/help/committee";
  }

  if (pathname.startsWith("/audit")) {
    return "/help/committee#auditor";
  }

  if (pathname.startsWith("/consent")) {
    return "/help/owner#privacy";
  }

  return "/help";
}
