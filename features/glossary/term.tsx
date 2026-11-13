import type { ReactNode } from "react";
import { InfoTip } from "@/features/glossary/info-tip";
import { glossary, GLOSSARY_UI, type GlossaryKey } from "@/lib/i18n/glossary";
import type { Locale } from "@/lib/i18n/locales";

/** A label followed by its "i" explanation. */
export function Term({
  children,
  k,
  locale,
}: {
  children?: ReactNode;
  k: GlossaryKey;
  locale: Locale;
}) {
  const entry = glossary(locale, k);

  return (
    <span className="inline-flex items-center gap-1">
      {children ?? entry.term}
      <InfoTip about={GLOSSARY_UI[locale].about} term={entry.term} text={entry.text} />
    </span>
  );
}

/** The same explanations as notes, for printed pages and PDFs. */
export function GlossaryNotes({
  className = "",
  keys,
  locale,
  printOnly = false,
}: {
  className?: string;
  keys: GlossaryKey[];
  locale: Locale;
  printOnly?: boolean;
}) {
  return (
    <dl
      className={[
        "mt-3 grid gap-1 text-xs leading-5",
        printOnly ? "hidden print:grid" : "",
        className,
      ].join(" ")}
      data-glossary-notes
    >
      {keys.map((key) => {
        const entry = glossary(locale, key);

        return (
          <div key={key}>
            <dt className="inline font-semibold">{entry.term}: </dt>
            <dd className="inline">{entry.text}</dd>
          </div>
        );
      })}
    </dl>
  );
}
