import { renderEmail, templateNameFromKey } from "@/features/email/templates";
import type { Locale } from "@/lib/i18n/locales";

/**
 * An email log's template in words (2026-11-19 review): its subject with the
 * meeting's name, e.g. "Voting results: DEMO M8", instead of the stored
 * "result_approved:<meeting id>". An unknown template keeps its code.
 */
export function emailTemplateLabel(
  templateKey: string,
  locale: Locale,
  meetingTitleById: ReadonlyMap<string, string>,
) {
  const name = templateNameFromKey(templateKey);

  if (!name) {
    return templateKey;
  }

  const meetingId = templateKey.slice(templateKey.indexOf(":") + 1);

  return renderEmail(name, locale, { meetingTitle: meetingTitleById.get(meetingId) ?? "-" }).subject;
}
