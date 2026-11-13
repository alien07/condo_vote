import type { Locale } from "@/lib/i18n/locales";

/** Admin-typed text in the reader's language (D020, demo feedback item 6b):
 * English when the page is English and English was written, else the Thai
 * text, which prevails. */
export function localized(
  locale: Locale,
  thai: string,
  english: string | null | undefined,
): string;
export function localized(
  locale: Locale,
  thai: string | null | undefined,
  english: string | null | undefined,
): string | null | undefined;
export function localized(
  locale: Locale,
  thai: string | null | undefined,
  english: string | null | undefined,
) {
  return locale === "en" && english?.trim() ? english : thai;
}
