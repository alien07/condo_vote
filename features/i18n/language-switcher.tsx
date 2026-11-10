import { setLanguage } from "@/features/i18n/actions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, type Locale } from "@/lib/i18n/locales";

// Two buttons, ไทย and EN. Works without JavaScript.
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).language;

  return (
    <form
      action={setLanguage}
      aria-label={t.label}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-[var(--border)] text-sm"
      role="group"
    >
      {LOCALES.map((option) => (
        <button
          aria-pressed={option === locale}
          className={[
            "min-h-11 min-w-11 px-3 font-medium",
            option === locale
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--surface)]",
          ].join(" ")}
          key={option}
          lang={option}
          name="language"
          type="submit"
          value={option}
        >
          {t[option]}
        </button>
      ))}
    </form>
  );
}
