import type { Locale } from "@/lib/i18n/locales";
import type { HelpGuide } from "@/lib/help/types";

// Committee guide, with a short part for auditors (help plan,
// docs/help-outline.md, guide 3). Screenshots: public/help/<locale>/<image>.png,
// made by `npm run help:screenshots` from the demo data.
// Thai is the text of record; English says the same thing.
// Button and status words must match lib/i18n/staff/committee.ts.

export const committeeGuide: Record<Locale, HelpGuide> = {
  th: {
    slug: "committee",
    audience: "คณะกรรมการและผู้ตรวจสอบ",
    title: "คู่มือคณะกรรมการ",
    summary:
      "ปิดลงคะแนนก่อนเวลาเมื่อจำเป็น ตรวจและอนุมัติผลการลงมติ และขอให้แก้ไขเมื่อพบสิ่งผิด ทั้งหมดทำในหน้า \"คณะกรรมการ\"",
    printTitle: "คู่มือฉบับย่อ: คณะกรรมการ",
    steps: [
      {
        id: "page",
        title: "เปิดหน้าคณะกรรมการ",
        body: "เข้าสู่ระบบด้วยบัญชี Google ที่นิติบุคคลลงทะเบียนเป็นกรรมการ แล้วกดเมนู \"คณะกรรมการ\" ด้านบนมีปุ่มสรุปจำนวนงาน กดเพื่อไปยังแต่ละส่วน หน้านี้มี 2 ส่วน: \"1. อนุมัติผล\" (ต้องทำ) สำหรับผลที่รออนุมัติ และ \"2. ปิดลงคะแนนก่อนเวลา\" (ไม่บังคับ) สำหรับการประชุมที่เปิดลงคะแนนอยู่",
        tip: "แต่ละการประชุมกำหนดจำนวนกรรมการที่ต้องอนุมัติเอง เช่น 2 จาก 3 คน",
        image: "committee-page",
      },
      {
        id: "propose-close",
        title: "(ถ้าจำเป็น) เสนอปิดลงคะแนนก่อนเวลา",
        body: "ถ้าไม่มีคำขอ ระบบปิดลงคะแนนเองตามเวลาที่กำหนด ถ้าต้องการปิดก่อน กด \"เสนอปิดก่อนเวลา\" ที่การประชุมนั้น ใส่เหตุผล เลือก \"ทันทีที่อนุมัติครบ\" หรือ \"ตามเวลาที่ระบุ\" แล้วกด \"ส่งคำขอ\" และ \"ยืนยัน\" ระบบส่งอีเมลถึงกรรมการทุกคนให้ตอบ",
        tip: "แต่ละการประชุมมีคำขอที่รอตอบได้ครั้งละหนึ่งคำขอ ถ้าผู้เสนอเป็นกรรมการ ระบบนับคำขอเป็นการอนุมัติของผู้เสนอด้วย ถ้าผู้เสนอเปลี่ยนใจ ให้กด \"ยกเลิกคำขอ\" (คัดค้านคำขอของตัวเองไม่ได้)",
        image: "committee-close-propose",
      },
      {
        id: "answer-close",
        title: "ตอบคำขอปิดก่อนเวลา",
        body: "คำขอจะแสดงที่การประชุมนั้น พร้อมผู้เสนอ เหตุผล และจำนวน เช่น \"อนุมัติแล้ว 1 จาก 2 (ต้องการอีก 1)\" กด \"อนุมัติปิด\" หรือ \"คัดค้าน\" การคัดค้านต้องใส่เหตุผล ซึ่งบันทึกไว้ตรวจสอบ เมื่ออนุมัติครบ ลงคะแนนจะปิดตามที่ขอ ถ้ากรรมการที่ยังไม่ตอบเหลือไม่พอให้ครบ คำขอจะ \"ไม่ผ่าน\" ทันที",
        tip: "เปลี่ยนคำตอบได้จนกว่าคำขอจะจบ ผู้เสนอกด \"ยกเลิกคำขอ\" ได้ และคำขอจะจบเองเมื่อถึงเวลาปิดปกติ คำขอที่ไม่ผ่านหรือถูกยกเลิกจะแสดงเป็น \"คำขอล่าสุด\" ที่การประชุมนั้น",
      },
      {
        id: "check-result",
        title: "ตรวจผลก่อนอนุมัติ",
        body: "หลังปิดลงคะแนน ผู้ดูแลสร้างผล แล้วผลจะแสดงใน \"1. อนุมัติผล\" ตรวจจำนวนบัตรที่นับเทียบกับห้องที่มีสิทธิ์ องค์ประชุม และผลกับเกณฑ์ของแต่ละวาระ กดปุ่ม \"i\" ข้างจำนวนการอนุมัติเพื่อดูว่าใครอนุมัติแล้ว",
        tip: "การอนุมัติหมายถึง \"ตัวเลขถูกต้อง\" ไม่ใช่ \"เห็นด้วยกับผล\" วาระที่ไม่ผ่านมติก็เป็นผลที่ถูกต้อง",
        image: "committee-result",
      },
      {
        id: "approve",
        title: "อนุมัติผล",
        body: "ถ้าตัวเลขถูกต้อง ใส่หมายเหตุได้ (ไม่บังคับ) กด \"อนุมัติผล\" แล้วกด \"ยืนยัน\" การ์ดจะแสดง \"ท่านอนุมัติแล้ว\" เมื่อกรรมการอนุมัติครบตามจำนวนที่กำหนด ระบบประกาศผล ส่งอีเมลแจ้งเจ้าของห้อง และสร้างไฟล์ PDF",
        tip: "ยกเลิกการอนุมัติไม่ได้ ผู้ที่สร้างผลหรือแก้ข้อมูลของผลนั้นอนุมัติผลนั้นเองไม่ได้",
      },
      {
        id: "correction",
        title: "ขอให้แก้ไข ถ้าพบสิ่งผิด",
        body: "อย่ากดอนุมัติ ให้กด \"ขอให้แก้ไข\" เลือก \"เรื่องที่ต้องแก้\" และ \"อธิบายสิ่งที่ผิด\" แล้วกด \"ส่งคำขอแก้ไข\" และ \"ยืนยัน\" (กด \"ยกเลิก\" เพื่อปิดฟอร์ม) ระบบแจ้งผู้ดูแล ผู้ดูแลต้องตอบทุกคำขอว่า \"แก้แล้ว\" หรือ \"ไม่ต้องแก้\" พร้อมเหตุผล ระหว่างนั้นกรรมการคนอื่นยังอนุมัติได้ แต่ผลจะยังไม่ประกาศจนกว่าผู้ดูแลจะตอบ",
        tip: "ผลหนึ่งชุดมีคำขอแก้ไขที่รอตอบได้ครั้งละหนึ่งคำขอ ไม่ว่าใครเป็นผู้ขอ และผู้ที่อนุมัติผลนั้นแล้วขอแก้ไขไม่ได้ แต่ละเรื่องมีระดับความรุนแรงตั้งต้น ผู้ดูแลปรับระดับขึ้นได้อย่างเดียว ดูคำอธิบายแต่ละระดับในคำถามที่พบบ่อย",
        image: "committee-correction",
      },
      {
        id: "after-fix",
        title: "อนุมัติอีกครั้งหลังแก้ไข",
        body: "เมื่อผู้ดูแลแก้ข้อมูลและสร้างผลใหม่ การอนุมัติเริ่มนับใหม่จากศูนย์ การ์ดใหม่แสดง \"สร้างผลใหม่หลังมีคำขอแก้ไข\" พร้อมเหตุผล และบอกว่าวาระใดตัวเลขเปลี่ยน กรรมการที่อนุมัติผลเดิมจะได้รับอีเมลให้ตรวจอีกครั้ง ผลเดิมและคำขอยังเก็บไว้ในประวัติ",
      },
      {
        id: "auditor",
        title: "สำหรับผู้ตรวจสอบ",
        body: "ผู้ตรวจสอบเห็นเมนู \"ตรวจสอบ\" ซึ่งแสดงผลที่ประกาศแล้วพร้อมเอกสารทางการ คำขอแก้ไขผล และบันทึกการใช้งานล่าสุด หน้านี้อ่านอย่างเดียว ผู้ตรวจสอบแก้ไขหรืออนุมัติสิ่งใดไม่ได้",
      },
    ],
    faq: [
      {
        q: "ระดับความรุนแรงของคำขอแก้ไขต่างกันอย่างไร",
        a: "ต่ำ: ข้อความวาระหรือตัวเลือกพิมพ์ผิด ตัวเลขไม่เปลี่ยน ผู้ดูแลแก้ข้อความแล้วสร้างผลใหม่ · กลาง: ข้อมูลห้องหรืออัตราส่วนกรรมสิทธิ์ สิทธิ์ลงคะแนนหรือการมอบฉันทะ บัตรกระดาษบันทึกผิดหรือขาด และ \"อื่น ๆ\" ผู้ดูแลแก้พร้อมแนบหลักฐาน แล้วสร้างผลใหม่ที่แสดงตัวเลขที่เปลี่ยน · สูง: เกณฑ์มติหรือองค์ประชุมตั้งค่าผิด หรือเจ้าของที่มีสิทธิ์ลงคะแนนไม่ได้ ต้องอ้างข้อกฎหมายหรือข้อบังคับ แก้ในผลไม่ได้ ตัดสินนอกระบบ (ประชุมกรรมการหรือปรึกษากฎหมาย) แล้วประกาศพร้อมหมายเหตุโดยกรรมการทุกคนอนุมัติ หรือยกเลิกวาระนั้นไปพิจารณาในการประชุมใหม่",
      },
      {
        q: "ทำไม \"อื่น ๆ\" เริ่มที่ระดับกลาง",
        a: "เพื่อไม่ให้ใช้ \"อื่น ๆ\" แก้ข้อมูลแบบเงียบ ๆ ทุกการแก้ระดับกลางขึ้นไปต้องแนบหลักฐาน และกรรมการทุกคนได้รับแจ้ง",
      },
      {
        q: "เรื่องใดขอแก้ไขไม่ได้",
        a: "การเปลี่ยนคะแนนที่เจ้าของห้องส่งออนไลน์ และการเปลี่ยนผลเพราะไม่เห็นด้วยกับผล",
      },
      {
        q: "ไม่เห็นปุ่ม \"อนุมัติผล\" หรืออนุมัติไม่สำเร็จ",
        a: "ท่านอาจอนุมัติผลนั้นแล้ว อาจเป็นผู้สร้างผลหรือแก้ข้อมูลของผลนั้น หรืออาจไม่ได้เป็นกรรมการที่ดำรงตำแหน่งอยู่ ติดต่อผู้ดูแลเพื่อตรวจรายชื่อกรรมการ",
      },
      {
        q: "อนุมัติไปแล้วเพิ่งพบว่าผิด ทำอย่างไร",
        a: "การอนุมัติยกเลิกไม่ได้ และผู้ที่อนุมัติแล้วขอแก้ไขในระบบไม่ได้ แจ้งผู้ดูแลหรือกรรมการคนอื่นที่ยังไม่อนุมัติให้ส่งคำขอแก้ไขแทน",
      },
      {
        q: "ผู้ดูแลที่ไม่ได้เป็นกรรมการทำอะไรในหน้านี้ได้",
        a: "เสนอปิดลงคะแนนก่อนเวลาได้ แต่ตอบคำขอและอนุมัติผลไม่ได้",
      },
      {
        q: "ต้องอนุมัติกี่คน",
        a: "ผู้ดูแลกำหนดต่อการประชุม และใช้จำนวนเดียวกันทั้งการปิดก่อนเวลาและการอนุมัติผล ยกเว้นผลที่มีคำขอแก้ไขระดับสูง ต้องให้กรรมการที่ดำรงตำแหน่งทุกคนอนุมัติ",
      },
    ],
    contact: "มีปัญหาการใช้งาน ติดต่อผู้ดูแลระบบของนิติบุคคล",
  },
  en: {
    slug: "committee",
    audience: "Committee members and auditors",
    title: "Committee guide",
    summary:
      "Close voting early when needed, check and approve results, and request a correction when something is wrong. All of it happens on the Committee page.",
    printTitle: "Quick guide: committee",
    steps: [
      {
        id: "page",
        title: "Open the Committee page",
        body: "Sign in with the Google account the office registered as a committee member, then tap \"Committee\" in the menu. Buttons at the top count the work and jump to each part. The page has two parts: \"1. Approve results\" (required) for results waiting for approval, and \"2. Close voting early\" (optional) for meetings that are open for voting.",
        tip: "Each meeting sets how many members must approve, for example 2 of 3.",
        image: "committee-page",
      },
      {
        id: "propose-close",
        title: "(If needed) Propose closing voting early",
        body: "Without a request, voting closes on time by itself. To close earlier, tap \"Propose closing early\" on that meeting, give a reason, choose \"As soon as approved\" or \"At this time\", then tap \"Send request\" and \"Confirm\". Every committee member is emailed and asked to answer.",
        tip: "A meeting has one open request at a time. If the proposer is a committee member, the request counts as their approval. To change their mind, the proposer taps \"Cancel request\" (they cannot object to their own request).",
        image: "committee-close-propose",
      },
      {
        id: "answer-close",
        title: "Answer a request to close early",
        body: "The request shows on that meeting with who proposed it, the reason, and a count such as \"Approved 1 of 2 (1 more needed)\". Tap \"Approve closing\" or \"Object\". Objecting needs a reason, which is kept for audit. When enough members approve, voting closes as requested. When the members who have not answered are too few to reach the number needed, the request \"Did not pass\" at once.",
        tip: "You can change your answer until the request ends. The proposer can tap \"Cancel request\", and the request ends by itself at the normal close time. A request that did not pass or was cancelled is shown as \"Last request\" on that meeting.",
      },
      {
        id: "check-result",
        title: "Check a result before approving",
        body: "After voting closes, the admin generates the result, and it appears under \"1. Approve results\". Check the ballots counted against the eligible rooms, the quorum, and each agenda result against its pass rule. Tap the \"i\" next to the approval count to see who has approved.",
        tip: "Approving means \"the numbers are correct\", not \"we agree with the outcome\". An agenda item that does not pass is a valid result.",
        image: "committee-result",
      },
      {
        id: "approve",
        title: "Approve the result",
        body: "If the numbers are correct, add a note if you like (optional), tap \"Approve result\", then \"Confirm\". The card shows \"You approved\". When enough members approve, the result is published, owners are emailed, and the PDF files are made.",
        tip: "An approval cannot be taken back. Whoever generated a result, or corrected its data, cannot approve it.",
      },
      {
        id: "correction",
        title: "Request a correction when something is wrong",
        body: "Do not approve. Tap \"Request a correction\", choose \"What needs correcting\", fill in \"Describe what is wrong\", then tap \"Send correction request\" and confirm (\"Cancel\" folds the form away). The admin is notified and must answer every request with \"Fixed\" or \"No change needed\" and a reason. Other members can still approve meanwhile, but the result is not published until the admin answers.",
        tip: "A result has one open correction request at a time, whoever asked, and a member who approved the result cannot request one. Each topic starts at a set level; the admin can raise it but never lower it. The levels are explained in the questions below.",
        image: "committee-correction",
      },
      {
        id: "after-fix",
        title: "Approve again after a correction",
        body: "When the admin fixes the data and generates the result again, approvals start again from zero. The new card says \"Generated again after a correction request\" with the reason, and which agenda items changed. Members who approved the earlier result are emailed to review again. The earlier result and the request stay in the history.",
      },
      {
        id: "auditor",
        title: "For auditors",
        body: "Auditors see the \"Audit\" menu: published results with their official records, correction requests, and the latest audit log entries. It is read only; an auditor cannot change or approve anything.",
      },
    ],
    faq: [
      {
        q: "How do the correction levels differ?",
        a: "Low: a typo in agenda or choice wording; numbers do not change; the admin fixes the wording and generates again. · Medium: room data or ownership share, voting rights or proxy, a paper ballot entered wrong or missing, and \"Other\"; the admin fixes it with evidence attached and generates again, showing which numbers changed. · High: the pass rule or quorum was set wrong, or an eligible owner could not vote; needs a legal or by-law reference; it cannot be fixed inside the result; it is decided outside the system (a committee meeting or legal advice), then either published with a note approved by every member, or the agenda item is voided and taken to a new meeting.",
      },
      {
        q: "Why does \"Other\" start at medium?",
        a: "So \"Other\" cannot be used to change data quietly. Every medium or high fix needs evidence, and every committee member is told.",
      },
      {
        q: "What cannot be corrected?",
        a: "Votes that owners submitted online, and a result that members simply disagree with.",
      },
      {
        q: "I do not see \"Approve result\", or approving fails",
        a: "You may have approved it already, you may have generated the result or corrected its data, or you may not be an active committee member. Ask the admin to check the committee list.",
      },
      {
        q: "I approved and then found a mistake. What now?",
        a: "An approval cannot be taken back, and a member who approved cannot request a correction in the system. Tell the admin, or a member who has not approved yet, so they can send a correction request.",
      },
      {
        q: "What can an admin who is not on the committee do here?",
        a: "Propose closing voting early. They cannot answer requests or approve results.",
      },
      {
        q: "How many approvals are needed?",
        a: "The admin sets it per meeting, and the same number applies to closing early and to approving results. A result with a high-level correction needs every active committee member.",
      },
    ],
    contact: "For help, contact your juristic person office's system administrator.",
  },
};
