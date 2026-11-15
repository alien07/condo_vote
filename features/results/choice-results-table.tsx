// Per-choice totals of one question from a result snapshot. Used on the
// Summary page and on the Committee page, so both read the same way.

import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { choiceLabel } from "@/lib/i18n/choice";
import { Term } from "@/features/glossary/term";
import { decidingColumn, GLOSSARY_UI } from "@/lib/i18n/glossary";

export type ChoiceResult = {
  id?: string;
  text?: string;
  is_abstain?: boolean;
  vote_count?: number;
  ownership?: number;
  percent_of_total_ownership?: number;
  percent_of_submitted_ownership?: number;
};

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}


export function ChoiceResultsTable({
  choices,
  locale = "en",
  ruleBasis,
}: {
  choices?: ChoiceResult[];
  locale?: Locale;
  /** pass_rule.basis: marks the column the rule compares against. */
  ruleBasis?: string | null;
}) {
  const t = getDictionary(locale).results;
  const label = {
    empty: t.noVotes,
    choice: t.choice,
    rooms: t.rooms,
    ownership: t.shareOfAll,
    ownershipShort: t.shareOfAllShort,
    cast: t.shareOfCast,
    castShort: t.shareOfCastShort,
  };

  const deciding = decidingColumn(ruleBasis);
  const decidesBadge = (
    <span className="mt-0.5 block text-xs font-semibold text-[var(--primary)]">
      {GLOSSARY_UI[locale].decides}
    </span>
  );

  if (!choices || choices.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">{label.empty}</p>;
  }

  const ownershipValue = (choice: ChoiceResult) => formatPercent(choice.percent_of_total_ownership ?? choice.ownership);
  const castValue = (choice: ChoiceResult) => formatPercent(choice.percent_of_submitted_ownership);

  return (
    <>
      {/* Phones: one block per choice instead of a four-column table, so
          nothing scrolls sideways (UI review 2026-11-15). The column
          explanations ("i") are given once, above the list. */}
      <div className="mt-2 sm:hidden" data-choice-list>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <Term k="rooms" locale={locale}>{label.rooms}</Term>
          <Term k="shareOfAll" locale={locale}>
            <span className={deciding === "shareOfAll" ? "font-semibold text-[var(--foreground)]" : ""}>{label.ownershipShort}</span>
          </Term>
          <Term k="shareOfCast" locale={locale}>
            <span className={deciding === "shareOfCast" ? "font-semibold text-[var(--foreground)]" : ""}>{label.castShort}</span>
          </Term>
        </p>
        {deciding ? (
          <p className="mt-0.5 text-xs font-semibold text-[var(--primary)]">
            {GLOSSARY_UI[locale].decides}: {deciding === "shareOfAll" ? label.ownershipShort : label.castShort}
          </p>
        ) : null}
        <ul className="mt-1 text-sm">
          {choices.map((choice, index) => (
            <li className="border-b border-[var(--border)] py-2 last:border-0" key={choice.id ?? `${choice.text}-${index}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {choiceLabel(choice.text, choice.is_abstain, locale)}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {label.rooms} {choice.vote_count ?? 0}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between gap-3 text-xs tabular-nums text-[var(--muted)]">
                <span className={deciding === "shareOfAll" ? "font-semibold text-[var(--foreground)]" : ""}>
                  {label.ownershipShort} {ownershipValue(choice)}
                </span>
                <span className={deciding === "shareOfCast" ? "font-semibold text-[var(--foreground)]" : ""}>
                  {label.castShort} {castValue(choice)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Larger screens: the table. Padding inside the scroll box keeps the
          44 px tap areas of the "i" buttons inside it, so no scroll bars
          appear when the table fits. */}
      <div className="-mx-3 mt-1 hidden overflow-x-auto px-3 py-3 [scrollbar-width:thin] sm:block" data-choice-table>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-[var(--border)] text-[var(--muted)]">
          <tr>
            <th className="min-w-24 py-2 pr-3 align-top font-medium">{label.choice}</th>
            <th className="whitespace-nowrap py-2 pr-3 text-right align-top font-medium">
              <Term k="rooms" locale={locale}>{label.rooms}</Term>
            </th>
            <th
              className={`whitespace-nowrap py-2 pr-3 text-right align-top font-medium ${deciding === "shareOfAll" ? "text-[var(--foreground)]" : ""}`}
              data-deciding={deciding === "shareOfAll" || undefined}
            >
              <Term k="shareOfAll" locale={locale}>
                <span className="sm:hidden">{label.ownershipShort}</span>
                <span className="hidden sm:inline">{label.ownership}</span>
              </Term>
              {deciding === "shareOfAll" ? decidesBadge : null}
            </th>
            <th
              className={`whitespace-nowrap py-2 text-right align-top font-medium ${deciding === "shareOfCast" ? "text-[var(--foreground)]" : ""}`}
              data-deciding={deciding === "shareOfCast" || undefined}
            >
              <Term k="shareOfCast" locale={locale}>
                <span className="sm:hidden">{label.castShort}</span>
                <span className="hidden sm:inline">{label.cast}</span>
              </Term>
              {deciding === "shareOfCast" ? decidesBadge : null}
            </th>
          </tr>
        </thead>
        <tbody>
          {choices.map((choice, index) => (
            <tr
              className="border-b border-[var(--border)] last:border-0"
              key={choice.id ?? `${choice.text}-${index}`}
            >
              <td className="min-w-24 py-2 pr-3">
                {choice.is_abstain ? (
                  <Term k="abstain" locale={locale}>
                    <span className="whitespace-nowrap">{choiceLabel(choice.text, choice.is_abstain, locale)}</span>
                  </Term>
                ) : (
                  choiceLabel(choice.text, choice.is_abstain, locale)
                )}
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{choice.vote_count ?? 0}</td>
              <td className={`whitespace-nowrap py-2 pr-3 text-right tabular-nums ${deciding === "shareOfAll" ? "font-semibold" : ""}`}>
                {formatPercent(choice.percent_of_total_ownership ?? choice.ownership)}
              </td>
              <td className={`whitespace-nowrap py-2 text-right tabular-nums ${deciding === "shareOfCast" ? "font-semibold" : ""}`}>
                {formatPercent(choice.percent_of_submitted_ownership)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
