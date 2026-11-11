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
