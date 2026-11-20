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
        tip: "มติต้องได้เสียงข้างมากของกรรมการที่ดำรงตำแหน่งทั้งหมด (รวมประธาน) เช่น 3 จาก 5 คน หรือ 3 จาก 4 คน ผู้จัดการกำหนดให้มากกว่านี้ได้แต่ไม่น้อยกว่า",
        image: "committee-page",
      },
      {
        id: "propose-close",
        title: "(ถ้าจำเป็น) เสนอปิดลงคะแนนก่อนเวลา",
        body: "ถ้าไม่มีคำขอ ระบบปิดลงคะแนนเองตามเวลาที่กำหนด ถ้าต้องการปิดก่อน กด \"เสนอปิดก่อนเวลา\" ที่การประชุมนั้น ใส่เหตุผล เลือก \"ทันทีที่อนุมัติครบ\" หรือ \"ตามเวลาที่ระบุ\" แล้วกด \"ส่งคำขอ\" และ \"ยืนยัน\" ระบบส่งอีเมลถึงกรรมการทุกคนให้ตอบ",
        tip: "แต่ละการประชุมมีคำขอที่รอตอบได้ครั้งละหนึ่งคำขอ ถ้าผู้เสนอเป็นกรรมการ ระบบนับคำขอเป็นการอนุมัติของผู้เสนอด้วย ถ้าผู้เสนอเปลี่ยนใจ ให้กด \"ยกเลิกคำขอ\" (คัดค้านคำขอของตัวเองไม่ได้) การประชุมที่มีลงคะแนนล่วงหน้า เสนอได้ตั้งแต่ช่วงล่วงหน้า แต่เวลาปิดต้องอยู่ในวันประชุม และเลือก \"ทันทีที่อนุมัติครบ\" ได้เมื่อเริ่มลงคะแนนวันประชุมแล้ว",
        image: "committee-close-propose",
      },
      {
        id: "answer-close",
        title: "ตอบคำขอปิดก่อนเวลา",
        body: "คำขอจะแสดงที่การประชุมนั้น พร้อมผู้เสนอ เหตุผล และจำนวน เช่น \"อนุมัติ 1 · ไม่อนุมัติ 0 · ต้องการ 3 จาก 4\" กด \"อนุมัติปิด\" หรือ \"คัดค้าน\" การคัดค้านต้องใส่เหตุผล ซึ่งบันทึกไว้ตรวจสอบ เมื่ออนุมัติครบ ลงคะแนนจะปิดตามที่ขอ เมื่อคัดค้านครบจำนวนเดียวกัน คำขอจะ \"ไม่ผ่าน\" ถ้าทุกคนตอบแล้วคะแนนเท่ากัน ประธานกรรมการ (หรือรองประธานเมื่อไม่มีประธาน) เป็นผู้ชี้ขาด",
        tip: "ตอบแล้วเปลี่ยนไม่ได้ ผู้เสนอกด \"ยกเลิกคำขอ\" ได้ และคำขอจะจบเองเมื่อถึงเวลาปิดปกติ คำขอที่ไม่ผ่านหรือถูกยกเลิกจะแสดงเป็น \"คำขอล่าสุด\" ที่การประชุมนั้น",
      },
      {
        id: "check-result",
        title: "ตรวจผลก่อนอนุมัติ",
        body: "หลังปิดลงคะแนน ผู้จัดการสร้างผล แล้วผลจะแสดงใน \"1. อนุมัติผล\" การ์ดบอกว่าใครอนุมัติแล้วและใครยังไม่อนุมัติ ตรวจจำนวนบัตรที่นับเทียบกับห้องที่มีสิทธิ์ และองค์ประชุม แต่ละวาระแสดงมติเป็นบรรทัดเดียว กด \"ดูตารางผลรายวาระ\" เพื่อดูคะแนนของทุกตัวเลือกเทียบกับเกณฑ์",
        tip: "การอนุมัติหมายถึง \"ตัวเลขถูกต้อง\" ไม่ใช่ \"เห็นด้วยกับผล\" วาระที่ไม่ผ่านมติก็เป็นผลที่ถูกต้อง",
        image: "committee-result",
      },
      {
        id: "approve",
        title: "อนุมัติผล",
        body: "ถ้าตัวเลขถูกต้อง กด \"+ เพิ่มหมายเหตุ\" ถ้าต้องการ (ไม่บังคับ) แล้วกด \"อนุมัติผล\" แล้วกด \"ยืนยัน\" การ์ดจะแสดง \"ท่านอนุมัติแล้ว\" เมื่อกรรมการอนุมัติครบตามจำนวนที่กำหนด ระบบประกาศผล ส่งอีเมลแจ้งเจ้าของห้อง และสร้างไฟล์ PDF",
        tip: "ถ้าตัวเลขผิดในแบบที่ขอแก้ไขไม่ได้ ให้กด \"ไม่อนุมัติ\" พร้อมเหตุผล ตอบแล้วเปลี่ยนไม่ได้ ผู้ที่สร้างผลหรือแก้ข้อมูลของผลนั้นตอบไม่ได้ ถ้าคะแนนเท่ากัน ประธานจะเห็นปุ่ม \"ชี้ขาด: อนุมัติ\" และ \"ชี้ขาด: ไม่อนุมัติ\"",
      },
      {
        id: "correction",
        title: "ขอให้แก้ไข ถ้าพบสิ่งผิด",
        body: "อย่ากดอนุมัติ ให้กด \"ขอให้แก้ไข\" เลือก \"เรื่องที่ต้องแก้\" และ \"อธิบายสิ่งที่ผิด\" แล้วกด \"ส่งคำขอแก้ไข\" และ \"ยืนยัน\" (กด \"ยกเลิก\" เพื่อปิดฟอร์ม) ระบบแจ้งผู้จัดการ ผู้จัดการต้องตอบทุกคำขอว่า \"แก้แล้ว\" หรือ \"ไม่ต้องแก้\" พร้อมเหตุผล ระหว่างนั้นกรรมการคนอื่นยังอนุมัติได้ แต่ผลจะยังไม่ประกาศจนกว่าผู้จัดการจะตอบ",
        tip: "ผลหนึ่งชุดมีคำขอแก้ไขที่รอตอบได้ครั้งละหนึ่งคำขอ ไม่ว่าใครเป็นผู้ขอ และผู้ที่อนุมัติผลนั้นแล้วขอแก้ไขไม่ได้ แต่ละเรื่องมีระดับความรุนแรงตั้งต้น ผู้จัดการปรับระดับขึ้นได้อย่างเดียว ดูคำอธิบายแต่ละระดับในคำถามที่พบบ่อย",
        image: "committee-correction",
      },
      {
        id: "after-fix",
        title: "อนุมัติอีกครั้งหลังแก้ไข",
        body: "เมื่อผู้จัดการแก้ข้อมูลและสร้างผลใหม่ การอนุมัติเริ่มนับใหม่จากศูนย์ การ์ดใหม่แสดง \"สร้างผลใหม่หลังมีคำขอแก้ไข\" พร้อมเหตุผล และบอกว่าวาระใดตัวเลขเปลี่ยน กรรมการที่อนุมัติผลเดิมจะได้รับอีเมลให้ตรวจอีกครั้ง ผลเดิมและคำขอยังเก็บไว้ในประวัติ",
      },
      {
        id: "auditor",
        title: "สำหรับผู้ตรวจสอบ",
        body: "ผู้ตรวจสอบเห็นเมนู \"ตรวจสอบ\" ซึ่งแสดงผลที่ประกาศแล้ว (กด \"ดูบันทึกผล (หน้าเว็บ)\" เพื่อเปิดบันทึกผล แล้วกด \"กลับ\" เพื่อกลับมาหน้านี้) คำขอแก้ไขผล และบันทึกการใช้งานล่าสุด หน้านี้อ่านอย่างเดียว ผู้ตรวจสอบแก้ไขหรืออนุมัติสิ่งใดไม่ได้",
      },
    ],
    faq: [
      {
        q: "ระดับความรุนแรงของคำขอแก้ไขต่างกันอย่างไร",
        a: "ต่ำ: ข้อความวาระหรือตัวเลือกพิมพ์ผิด ตัวเลขไม่เปลี่ยน ผู้จัดการแก้ข้อความแล้วสร้างผลใหม่ · กลาง: ข้อมูลห้องหรืออัตราส่วนกรรมสิทธิ์ สิทธิ์ลงคะแนนหรือการมอบฉันทะ บัตรกระดาษบันทึกผิดหรือขาด และ \"อื่น ๆ\" ผู้จัดการแก้พร้อมแนบหลักฐาน แล้วสร้างผลใหม่ที่แสดงตัวเลขที่เปลี่ยน · สูง: เกณฑ์มติหรือองค์ประชุมตั้งค่าผิด หรือเจ้าของที่มีสิทธิ์ลงคะแนนไม่ได้ ต้องอ้างข้อกฎหมายหรือข้อบังคับ แก้ในผลไม่ได้ ตัดสินนอกระบบ (ประชุมกรรมการหรือปรึกษากฎหมาย) แล้วประกาศพร้อมหมายเหตุโดยกรรมการทุกคนอนุมัติ หรือยกเลิกวาระนั้นไปพิจารณาในการประชุมใหม่",
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
        a: "ท่านอาจอนุมัติผลนั้นแล้ว อาจเป็นผู้สร้างผลหรือแก้ข้อมูลของผลนั้น หรืออาจไม่ได้เป็นกรรมการที่ดำรงตำแหน่งอยู่ ติดต่อผู้จัดการเพื่อตรวจรายชื่อกรรมการ",
      },
      {
        q: "อนุมัติไปแล้วเพิ่งพบว่าผิด ทำอย่างไร",
        a: "การอนุมัติยกเลิกไม่ได้ และผู้ที่อนุมัติแล้วขอแก้ไขในระบบไม่ได้ แจ้งผู้จัดการหรือกรรมการคนอื่นที่ยังไม่อนุมัติให้ส่งคำขอแก้ไขแทน",
      },
      {
        q: "ผู้จัดการที่ไม่ได้เป็นกรรมการทำอะไรในหน้านี้ได้",
        a: "เสนอปิดลงคะแนนก่อนเวลาได้ และดูความคืบหน้าได้ แต่ตอบคำขอ อนุมัติ หรือไม่อนุมัติผลไม่ได้ เพราะมตินับเฉพาะกรรมการที่ดำรงตำแหน่ง",
      },
      {
        q: "ต้องอนุมัติกี่คน",
        a: "เสียงข้างมากของกรรมการที่ดำรงตำแหน่งทั้งหมด (N หาร 2 ปัดลง บวก 1 เช่น 3 จาก 5, 3 จาก 4, 4 จาก 6) ผู้จัดการกำหนดต่อการประชุมให้มากกว่านี้ได้ ใช้จำนวนเดียวกันทั้งการปิดก่อนเวลาและการอนุมัติผล ไม่อนุมัติครบจำนวนเดียวกัน = ไม่ผ่าน ทุกคนตอบแล้วคะแนนเท่ากัน = ประธานชี้ขาด (พ.ร.บ.อาคารชุด มาตรา 37/6) ผลที่มีคำขอแก้ไขระดับสูงต้องให้กรรมการทุกคนอนุมัติ",
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
        tip: "A decision needs a majority of all active members, the chair included, for example 3 of 5 or 3 of 4. The Manager can set more, never fewer.",
        image: "committee-page",
      },
      {
        id: "propose-close",
        title: "(If needed) Propose closing voting early",
        body: "Without a request, voting closes on time by itself. To close earlier, tap \"Propose closing early\" on that meeting, give a reason, choose \"As soon as approved\" or \"At this time\", then tap \"Send request\" and \"Confirm\". Every committee member is emailed and asked to answer.",
        tip: "A meeting has one open request at a time. If the proposer is a committee member, the request counts as their approval. To change their mind, the proposer taps \"Cancel request\" (they cannot object to their own request). For a meeting with advance voting, a request can be sent during advance voting, but the close time must be on the meeting day, and \"As soon as approved\" is available once meeting-day voting starts.",
        image: "committee-close-propose",
      },
      {
        id: "answer-close",
        title: "Answer a request to close early",
        body: "The request shows on that meeting with who proposed it, the reason, and a count such as \"Approved 1 · Not approved 0 · Needs 3 of 4\". Tap \"Approve closing\" or \"Object\". Objecting needs a reason, which is kept for audit. When enough members approve, voting closes as requested; when the same number object, the request \"Did not pass\". If everyone has answered and the votes are tied, the chair (or the vice chair when there is no chair) casts the deciding vote.",
        tip: "An answer cannot be changed. The proposer can tap \"Cancel request\", and the request ends by itself at the normal close time. A request that did not pass or was cancelled is shown as \"Last request\" on that meeting.",
      },
      {
        id: "check-result",
        title: "Check a result before approving",
        body: "After voting closes, the Manager generates the result, and it appears under \"1. Approve results\". The card shows who has approved and who has not. Check the ballots counted against the eligible rooms, and the quorum. Each agenda item shows its outcome in one line; tap \"Show the result tables\" to see every choice against the pass rule.",
        tip: "Approving means \"the numbers are correct\", not \"we agree with the outcome\". An agenda item that does not pass is a valid result.",
        image: "committee-result",
      },
      {
        id: "approve",
        title: "Approve the result",
        body: "If the numbers are correct, tap \"+ Add a note\" if you like (optional), then \"Approve result\", then \"Confirm\". The card shows \"You approved\". When enough members approve, the result is published, owners are emailed, and the PDF files are made.",
        tip: "If the numbers are wrong for a reason a correction cannot fix, tap \"Do not approve\" and give a reason. An answer cannot be taken back. Whoever generated a result, or corrected its data, cannot answer on it. If the votes end tied, the chair sees \"Decide: approve\" and \"Decide: do not approve\".",
      },
      {
        id: "correction",
        title: "Request a correction when something is wrong",
        body: "Do not approve. Tap \"Request a correction\", choose \"What needs correcting\", fill in \"Describe what is wrong\", then tap \"Send correction request\" and confirm (\"Cancel\" folds the form away). The Manager is notified and must answer every request with \"Fixed\" or \"No change needed\" and a reason. Other members can still approve meanwhile, but the result is not published until the Manager answers.",
        tip: "A result has one open correction request at a time, whoever asked, and a member who approved the result cannot request one. Each topic starts at a set level; the Manager can raise it but never lower it. The levels are explained in the questions below.",
        image: "committee-correction",
      },
      {
        id: "after-fix",
        title: "Approve again after a correction",
        body: "When the Manager fixes the data and generates the result again, approvals start again from zero. The new card says \"Generated again after a correction request\" with the reason, and which agenda items changed. Members who approved the earlier result are emailed to review again. The earlier result and the request stay in the history.",
      },
      {
        id: "auditor",
        title: "For auditors",
        body: "Auditors see the \"Audit\" menu: published results (tap \"View record (web page)\" to open a record, then \"Back\" to return), correction requests, and the latest audit log entries. It is read only; an auditor cannot change or approve anything.",
      },
    ],
    faq: [
      {
        q: "How do the correction levels differ?",
        a: "Low: a typo in agenda or choice wording; numbers do not change; the Manager fixes the wording and generates again. · Medium: room data or ownership share, voting rights or proxy, a paper ballot entered wrong or missing, and \"Other\"; the Manager fixes it with evidence attached and generates again, showing which numbers changed. · High: the pass rule or quorum was set wrong, or an eligible owner could not vote; needs a legal or by-law reference; it cannot be fixed inside the result; it is decided outside the system (a committee meeting or legal advice), then either published with a note approved by every member, or the agenda item is voided and taken to a new meeting.",
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
        a: "You may have approved it already, you may have generated the result or corrected its data, or you may not be an active committee member. Ask the Manager to check the committee list.",
      },
      {
        q: "I approved and then found a mistake. What now?",
        a: "An approval cannot be taken back, and a member who approved cannot request a correction in the system. Tell the Manager, or a member who has not approved yet, so they can send a correction request.",
      },
      {
        q: "What can a Manager who is not on the committee do here?",
        a: "Propose closing voting early and see the progress. They cannot answer requests or approve or not approve results: the majority counts active committee members only.",
      },
      {
        q: "How many approvals are needed?",
        a: "A majority of all active members (N divided by 2, rounded down, plus 1: 3 of 5, 3 of 4, 4 of 6). The Manager can set more per meeting. The same number applies to closing early and to approving results. The same number of \"not approved\" answers means it did not pass; a tie once everyone has answered is decided by the chair (Condominium Act section 37/6). A result with a high-level correction needs every active member.",
      },
    ],
    contact: "For help, contact your juristic person office's system administrator.",
  },
};
