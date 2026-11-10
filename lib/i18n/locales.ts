// Languages for owner-facing pages, emails and the owner summary (D020).
// Thai is the default; admin and committee pages stay in English for now.

export const LOCALES = ["th", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";

/** Cookie set by the language switcher. It wins over the profile so a
 * browser keeps the language its user picked. */
export const LOCALE_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
