import type { Locale } from "@/lib/i18n/locales";

// Email content in Thai and English (D020). Each queued email keeps the
// recipient's language in email_logs.language. Admin-editable templates are
// planned for V2; until then the text lives here.
//
// Placeholders: {meetingTitle}, {link}, {projectName}, {helpLink} (the
// owner guide, /help/owner).

export type EmailTemplateName = "vote_invitation" | "vote_fyi" | "result_approved";

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
