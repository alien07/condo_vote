import type { Locale } from "@/lib/i18n/locales";

// Email content in Thai and English (D020). Each queued email keeps the
// recipient's language in email_logs.language. Admin-editable templates are
// planned for V2; until then the text lives here.
//
// Placeholders: {meetingTitle}, {link}, {projectName}, {helpLink} (the
// owner guide, /help/owner).

export type EmailTemplateName =
  | "vote_invitation"
  | "vote_fyi"
  | "result_approved"
  // Committee workflow (migration 0030, demo feedback items 10 and 12).
  | "close_request"
  | "close_request_failed"
  | "result_correction"
  | "result_correction_answered"
  | "result_review_again";

type EmailContent = { subject: string; body: string };

const templates: Record<EmailTemplateName, Record<Locale, EmailContent>> = {
  vote_invitation: {
    th: {
      subject: "เชิญลงคะแนน: {meetingTitle}",
      body:
        "เรียน เจ้าของร่วม {projectName}\n\nท่านมีสิทธิ์ลงคะแนนในการประชุม {meetingTitle}\nเข้าสู่ระบบด้วยบัญชี Google เพื่อลงคะแนน: {link}\n\nท่านแก้ไขคะแนนได้จนกว่าจะปิดลงคะแนน\nวิธีลงคะแนนทีละขั้น: {helpLink}\n\nนิติบุคคลอาคารชุด {projectName}",
    },
    en: {
      subject: "Invitation to vote: {meetingTitle}",
      body:
        "Dear co-owner of {projectName},\n\nYou can vote in {meetingTitle}.\nSign in with your Google account to vote: {link}\n\nYou can change your ballot until voting closes.\nStep-by-step guide: {helpLink}\n\n{projectName} juristic person",
    },
  },
  vote_fyi: {
    th: {
      subject: "แจ้งการประชุม: {meetingTitle}",
      body:
        "เรียน ผู้พักอาศัย {projectName}\n\nนิติบุคคลแจ้งให้ทราบเรื่องการประชุม {meetingTitle}\nดูรายละเอียดได้ที่: {link}\n\nนิติบุคคลอาคารชุด {projectName}",
    },
    en: {
      subject: "Meeting notice: {meetingTitle}",
      body:
        "Dear resident of {projectName},\n\nFor your information: {meetingTitle}.\nDetails: {link}\n\n{projectName} juristic person",
    },
  },
  close_request: {
    th: {
      subject: "ขอปิดลงคะแนนก่อนเวลา: {meetingTitle}",
      body:
        "เรียน กรรมการ\n\nมีคำขอปิดลงคะแนนของ {meetingTitle} ก่อนเวลาที่กำหนด\nโปรดเข้าไปอนุมัติหรือคัดค้านพร้อมเหตุผลที่หน้าคณะกรรมการ: {link}\n\nนิติบุคคลอาคารชุด {projectName}",
    },
    en: {
      subject: "Request to close voting early: {meetingTitle}",
      body:
        "Dear committee member,\n\nSomeone asked to close voting for {meetingTitle} before the set time.\nPlease approve or object, with a reason, on the Committee page: {link}\n\n{projectName} juristic person",
    },
  },
  close_request_failed: {
    th: {
      subject: "คำขอปิดก่อนเวลาไม่ผ่าน: {meetingTitle}",
      body:
        "คำขอปิดลงคะแนนก่อนเวลาของ {meetingTitle} ไม่ผ่าน เพราะกรรมการที่ยังไม่ตอบมีไม่พอให้ครบจำนวน ลงคะแนนจะปิดตามเวลาเดิม\nดูเหตุผลที่หน้าคณะกรรมการ: {link}",
    },
    en: {
      subject: "Request to close early did not pass: {meetingTitle}",
      body:
        "The request to close voting for {meetingTitle} early did not pass: too few committee members are left to reach the number needed. Voting closes at the set time.\nSee the reasons on the Committee page: {link}",
    },
  },
  result_correction: {
    th: {
      subject: "กรรมการขอให้แก้ไขผล: {meetingTitle}",
      body:
        "กรรมการขอให้แก้ไขผลการลงมติของ {meetingTitle}\nโปรดตรวจและตอบคำขอที่หน้าผู้ดูแล > ผลการลงมติ: {link}",
    },
    en: {
      subject: "Committee asked for a result correction: {meetingTitle}",
      body:
        "A committee member asked for a correction of the result of {meetingTitle}.\nPlease check and answer the request in Admin > Results: {link}",
    },
  },
  result_correction_answered: {
    th: {
      subject: "ผู้ดูแลตอบคำขอแก้ไขผล: {meetingTitle}",
      body: "ผู้ดูแลตอบคำขอแก้ไขผลของ {meetingTitle} แล้ว ดูคำตอบได้ที่หน้าคณะกรรมการ: {link}",
    },
    en: {
      subject: "Your correction request was answered: {meetingTitle}",
      body: "The admin answered your correction request for {meetingTitle}. See the answer on the Committee page: {link}",
    },
  },
  result_review_again: {
    th: {
      subject: "โปรดตรวจผลใหม่: {meetingTitle}",
      body:
        "ผลการลงมติของ {meetingTitle} ถูกสร้างใหม่หลังมีคำขอแก้ไข การอนุมัติเดิมไม่นับต่อ\nโปรดตรวจและอนุมัติผลชุดใหม่ที่หน้าคณะกรรมการ: {link}",
    },
    en: {
      subject: "Please review the result again: {meetingTitle}",
      body:
        "The result of {meetingTitle} was generated again after a correction request. Earlier approvals do not carry over.\nPlease review and approve the new result on the Committee page: {link}",
    },
  },
  result_approved: {
    th: {
      subject: "ประกาศผลการลงมติ: {meetingTitle}",
      body:
        "เรียน เจ้าของร่วม {projectName}\n\nคณะกรรมการอนุมัติผลการลงมติของ {meetingTitle} แล้ว\nดูประกาศผลฉบับสรุป: {link}\n\nนิติบุคคลอาคารชุด {projectName}",
    },
    en: {
      subject: "Voting results: {meetingTitle}",
      body:
        "Dear co-owner of {projectName},\n\nThe committee approved the results of {meetingTitle}.\nSee the result summary: {link}\n\nThis is an English translation; the Thai announcement prevails.\n\n{projectName} juristic person",
    },
  },
};

/** template_key is "<name>:<meetingId>". */
export function templateNameFromKey(templateKey: string): EmailTemplateName | null {
  const name = templateKey.split(":")[0];

  return name in templates ? (name as EmailTemplateName) : null;
}

export function renderEmail(
  name: EmailTemplateName,
  locale: Locale,
  values: Partial<Record<"meetingTitle" | "link" | "projectName" | "helpLink", string>> = {},
): EmailContent {
  const content = templates[name][locale];
  const fill = (text: string) =>
    text.replace(/\{(meetingTitle|link|projectName|helpLink)\}/g, (match, key: keyof typeof values) =>
      values[key] ?? match,
    );

  return { subject: fill(content.subject), body: fill(content.body) };
}
