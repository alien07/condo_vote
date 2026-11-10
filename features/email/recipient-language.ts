import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

// Each queued email goes out in the recipient's language; people without a
// profile get Thai (D020).
export function withRecipientLanguage<Row extends { recipient_email: string }>(
  rows: Row[],
  profiles: { email: string; preferred_language: string }[],
): (Row & { language: Locale })[] {
  const languageByEmail = new Map(
    profiles.map((profile) => [
      profile.email.toLowerCase(),
      isLocale(profile.preferred_language) ? profile.preferred_language : DEFAULT_LOCALE,
    ]),
  );

  return rows.map((row) => ({
    ...row,
    language: languageByEmail.get(row.recipient_email.toLowerCase()) ?? DEFAULT_LOCALE,
  }));
}
