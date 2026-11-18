import type { Locale } from "@/lib/i18n/locales";

// The database adds an "Abstain" choice to every question (D017). Show it in
// the reader's language; a name the admin typed is shown as written.
const DEFAULT_ABSTAIN = "Abstain";
const ABSTAIN_LABEL: Record<Locale, string> = { th: "งดออกเสียง", en: "Abstain" };

export function choiceLabel(
  text: string | null | undefined,
  isAbstain: boolean | null | undefined,
  locale: Locale,
) {
  if (isAbstain && (text ?? "").trim() === DEFAULT_ABSTAIN) {
    return ABSTAIN_LABEL[locale];
  }

  return text ?? "-";
}

/** Choice names from voter comments (0040 returns names only, no flag):
 * the fixed Abstain name, which the database keeps as "Abstain" (0041), in
 * the reader's language (2026-11-19). */
export function choiceTextsLabel(texts: string[], locale: Locale) {
  return texts.map((text) => choiceLabel(text, text.trim() === DEFAULT_ABSTAIN, locale)).join(", ");
}
