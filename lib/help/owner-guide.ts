import type { Locale } from "@/lib/i18n/locales";
import type { HelpGuide } from "@/lib/help/types";
import { GLOSSARY, type GlossaryKey } from "@/lib/i18n/glossary";

// "How to read the result table": the same words as the "i" tips.
const TABLE_TERMS: GlossaryKey[] = ["rooms", "shareOfAll", "shareOfCast", "abstain", "rule"];

function tableTerms(locale: Locale) {
  return TABLE_TERMS.map((key) => `${GLOSSARY[locale][key].term}: ${GLOSSARY[locale][key].text}`).join(" · ");
}

// Owner and proxy quick guide (help plan, docs/help-outline.md).
// Screenshots: public/help/<locale>/<image>.png, made by
// `npm run help:screenshots` from the demo data, so they follow the UI.
// Thai is the text of record; English says the same thing.

export const ownerGuide: Record<Locale, HelpGuide> = {
  th: {
    slug: "owner",
    audience: "เจ้าของร่วมและผู้รับมอบฉันทะ",
    title: "วิธีลงคะแนนออนไลน์",
    summary:
      "ลงคะแนนการประชุมใหญ่จากมือถือหรือคอมพิวเตอร์ได้ใน 6 ขั้น ใช้เวลาประมาณ 3 นาที",
    printTitle: "คู่มือฉบับย่อ: ลงคะแนนออนไลน์",
    steps: [
      {
        id: "sign-in",
        title: "เข้าสู่ระบบด้วย Google",
        body: "เปิดลิงก์ในอีเมลเชิญประชุม แล้วกด \"เข้าสู่ระบบด้วย Google\" ใช้บัญชี Google ของอีเมลที่ท่านแจ้งไว้กับนิติบุคคล ระบบจึงจะรู้ว่าท่านเป็นเจ้าของห้องใด",
        tip: "เปลี่ยนภาษาได้ที่ปุ่ม ไทย / EN มุมขวาบนทุกหน้า",
        image: "owner-login",
      },
      {
        id: "privacy",
        title: "อ่านและยอมรับประกาศความเป็นส่วนตัว",
        body: "ครั้งแรกที่เข้าใช้ และทุกครั้งที่นิติบุคคลแก้ไขประกาศ ระบบจะแสดงประกาศความเป็นส่วนตัว (PDPA) ให้อ่าน กด \"ยอมรับ\" เพื่อใช้งานต่อ",
        tip: "ถ้ากด \"ไม่ยอมรับ\" ระบบจะออกจากระบบ และท่านจะลงคะแนนออนไลน์ไม่ได้",
        image: "owner-consent",
      },
      {
        id: "choose",
        title: "เลือกการประชุมและห้อง",
        body: "หน้า \"ลงคะแนน\" แสดงหนึ่งรายการต่อหนึ่งห้องในแต่ละการประชุม ถ้ามีหลายห้องจะลงคะแนนแยกกันทีละห้อง ห้องที่ท่านรับมอบฉันทะจะมีคำว่า \"ผู้รับมอบฉันทะ\" กด \"เปิดบัตรลงคะแนน\" ที่รายการที่สถานะเป็น \"เปิดลงคะแนน\"",
        tip: "\"ยังไม่เปิด\" คือยังไม่ถึงเวลาลงคะแนน ดูเวลาเปิดได้ใต้ชื่อห้อง",
        image: "owner-vote-list",
      },
      {
        id: "vote",
        title: "เลือกคำตอบทุกวาระ แล้วกดส่ง",
        body: "เลือกคำตอบของแต่ละวาระ วาระที่มีเครื่องหมาย * ต้องตอบ บางวาระเลือกได้หลายข้อตามที่ระบุ \"งดออกเสียง\" เลือกร่วมกับตัวเลือกอื่นไม่ได้ เมื่อครบแล้วกด \"ส่งบัตรลงคะแนน\"",
        tip: "ถ้าการประชุมเป็นการลงคะแนนลับ ผู้ดูแลจะเห็นเฉพาะยอดรวม ไม่เห็นคำตอบของท่าน",
        image: "owner-ballot",
      },
      {
        id: "change",
        title: "ตรวจหรือแก้ไขคะแนนได้จนกว่าจะปิด",
        body: "หลังส่งแล้ว รายการจะแสดง \"ส่งแล้ว ฉบับที่ 1\" ท่านเปิดบัตรเดิมเพื่อแก้ไขและส่งใหม่ได้จนกว่าจะปิดลงคะแนน ระบบนับเฉพาะฉบับสุดท้าย และเก็บประวัติทุกฉบับไว้ตรวจสอบ",
        image: "owner-ballot-history",
      },
      {
        id: "results",
        title: "ดูประกาศผล",
        body: "เมื่อปิดลงคะแนนและคณะกรรมการอนุมัติผลแล้ว ท่านจะได้รับอีเมลแจ้ง ดูผลได้ที่หน้า \"ผลการลงมติ\" ซึ่งมีผลรายวาระ ไฟล์ PDF และเลขอ้างอิงสำหรับตรวจสอบกับฉบับทางการ",
        image: "owner-summary",
      },
    ],
    faq: [
      {
        q: "เข้าสู่ระบบแล้ว แต่ไม่เห็นห้องของฉัน",
        a: "อีเมลของบัญชี Google ที่ใช้อาจไม่ตรงกับที่แจ้งไว้กับนิติบุคคล หรือท่านมอบฉันทะห้องนั้นให้ผู้อื่นแล้ว ติดต่อสำนักงานนิติบุคคลเพื่อตรวจอีเมลและสิทธิ์ของท่าน",
      },
      {
        q: "ไม่มีบัญชี Google ทำอย่างไร",
        a: "สร้างบัญชี Google ได้ฟรี แล้วแจ้งอีเมลนั้นกับนิติบุคคลก่อนวันประชุม หรือลงคะแนนด้วยบัตรกระดาษที่จุดลงทะเบียน",
      },
      {
        q: "ต้องการมอบฉันทะให้ผู้อื่นลงคะแนนแทน",
        a: "ยื่นหนังสือมอบฉันทะกับนิติบุคคล เมื่ออนุมัติแล้ว ห้องนั้นจะไปอยู่ในรายการของผู้รับมอบฉันทะ และเจ้าของจะลงคะแนนห้องนั้นเองในการประชุมนั้นไม่ได้ ผู้รับมอบฉันทะหนึ่งคนรับได้ไม่เกิน 3 ห้องต่อการประชุม",
      },
      {
        q: "ลงคะแนนออนไลน์แล้ว และยื่นบัตรกระดาษด้วย นับอย่างไร",
        a: "หนึ่งห้องนับได้หนึ่งเสียง นิติบุคคลจะเลือกใช้ฉบับเดียวและบันทึกเหตุผลไว้ เพื่อความชัดเจนควรลงคะแนนช่องทางเดียว",
      },
      {
        q: "\"ลงคะแนนล่วงหน้า\" คืออะไร",
        a: "บางการประชุมเปิดให้ลงคะแนนก่อนวันประชุม ระหว่างช่วงล่วงหน้ากับวันประชุมจะลงคะแนนไม่ได้ชั่วคราว รายการจะแสดงเวลาที่เปิดครั้งถัดไป",
      },
      {
        q: "อ่านตารางผลรายวาระอย่างไร",
        a: tableTerms("th"),
      },
      {
        q: "ทำไมยังไม่เห็นผล",
        a: "ผลจะแสดงหลังปิดลงคะแนนและคณะกรรมการอนุมัติครบตามจำนวนที่กำหนดเท่านั้น",
      },
      {
        q: "จะรู้ได้อย่างไรว่าเอกสารผลเป็นของจริง",
        a: "ในประกาศผลมีเลขอ้างอิงและค่า SHA-256 กด \"ตรวจสอบเลขอ้างอิงนี้\" แล้วเทียบค่าที่แสดงกับในเอกสาร ถ้าตรงกันคือผลชุดเดียวกับที่ระบบเก็บไว้",
      },
    ],
    contact:
      "มีปัญหาการใช้งาน ติดต่อสำนักงานนิติบุคคลอาคารชุดของท่าน",
  },
  en: {
    slug: "owner",
    audience: "Co-owners and proxies",
    title: "How to vote online",
    summary:
      "Vote in a general meeting from your phone or computer in 6 steps. It takes about 3 minutes.",
    printTitle: "Quick guide: voting online",
    steps: [
      {
        id: "sign-in",
        title: "Sign in with Google",
        body: "Open the link in the meeting invitation email and tap \"Continue with Google\". Use the Google account of the email you gave the juristic person office, so the system knows which rooms are yours.",
        tip: "Switch language with the ไทย / EN buttons at the top right of every page.",
        image: "owner-login",
      },
      {
        id: "privacy",
        title: "Read and accept the privacy notice",
        body: "The first time you sign in, and each time the office changes it, the system shows the privacy notice (PDPA). Tap \"I accept\" to continue.",
        tip: "If you decline, you are signed out and cannot vote online.",
        image: "owner-consent",
      },
      {
        id: "choose",
        title: "Choose the meeting and room",
        body: "The Vote page shows one item per room for each meeting. If you have several rooms, vote for each room separately. Rooms you hold as a proxy are marked \"Proxy\". Tap \"Open ballot\" on an item whose status is \"Open\".",
        tip: "\"Not open yet\" means voting has not started; the opening time is shown under the room.",
        image: "owner-vote-list",
      },
      {
        id: "vote",
        title: "Answer every agenda item, then submit",
        body: "Choose an answer for each agenda item. Items marked * are required. Some items allow several choices, as shown. \"Abstain\" cannot be combined with other choices. When you are done, tap \"Submit ballot\".",
        tip: "In a secret ballot, admins see only totals, never your answers.",
        image: "owner-ballot",
      },
      {
        id: "change",
        title: "Check or change your vote until voting closes",
        body: "After you submit, the item shows \"Submitted v1\". Open the same ballot to change and submit again until voting closes. Only the last version counts, and every version is kept for audit.",
        image: "owner-ballot-history",
      },
      {
        id: "results",
        title: "See the results",
        body: "When voting has closed and the committee has approved the results, you get an email. The Summary page shows each agenda result, a PDF file, and a reference to check against the official record.",
        image: "owner-summary",
      },
    ],
    faq: [
      {
        q: "I signed in but do not see my room",
        a: "The email of your Google account may not match the one the office has, or you gave a proxy for that room. Contact the juristic person office to check your email and voting rights.",
      },
      {
        q: "I do not have a Google account",
        a: "Create a free Google account and give its email to the office before the meeting, or vote with a paper ballot at the registration desk.",
      },
      {
        q: "I want someone else to vote for me",
        a: "Give a proxy form to the office. Once approved, the room moves to the proxy's list and the owner cannot vote for that room in that meeting. One proxy can hold at most 3 rooms per meeting.",
      },
      {
        q: "I voted online and also handed in a paper ballot",
        a: "Each room has one vote. The office chooses one ballot and records why. To keep it clear, vote through one channel only.",
      },
      {
        q: "What is advance voting?",
        a: "Some meetings open voting before the meeting day. Between the advance window and the meeting day, voting is paused; the item shows when it opens next.",
      },
      {
        q: "How do I read the result table?",
        a: tableTerms("en"),
      },
      {
        q: "Why can't I see the results yet?",
        a: "Results appear only after voting closes and the required number of committee members approve them.",
      },
      {
        q: "How do I know a result document is genuine?",
        a: "The announcement has a reference and a SHA-256 value. Tap \"Verify this reference\" and compare the value shown with the one in the document. If they match, it is the same result the system keeps.",
      },
    ],
    contact: "For help, contact your condominium's juristic person office.",
  },
};
