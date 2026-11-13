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
    cast: t.shareOfCast,
  };

  const deciding = decidingColumn(ruleBasis);
  const decidesBadge = (
    <span className="mt-0.5 block text-[11px] font-semibold text-[var(--primary)]">
      {GLOSSARY_UI[locale].decides}
    </span>
  );

  if (!choices || choices.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">{label.empty}</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-[var(--border)] text-[var(--muted)]">
          <tr>
            <th className="py-2 pr-3 align-top font-medium">{label.choice}</th>
            <th className="py-2 pr-3 text-right align-top font-medium">
              <Term k="rooms" locale={locale}>{label.rooms}</Term>
            </th>
            <th
              className={`py-2 pr-3 text-right align-top font-medium ${deciding === "shareOfAll" ? "text-[var(--foreground)]" : ""}`}
              data-deciding={deciding === "shareOfAll" || undefined}
            >
              <Term k="shareOfAll" locale={locale}>{label.ownership}</Term>
              {deciding === "shareOfAll" ? decidesBadge : null}
            </th>
            <th
              className={`py-2 text-right align-top font-medium ${deciding === "shareOfCast" ? "text-[var(--foreground)]" : ""}`}
              data-deciding={deciding === "shareOfCast" || undefined}
            >
              <Term k="shareOfCast" locale={locale}>{label.cast}</Term>
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
              <td className="py-2 pr-3">
                {choice.is_abstain ? (
                  <Term k="abstain" locale={locale}>
                    {choiceLabel(choice.text, choice.is_abstain, locale)}
                  </Term>
                ) : (
                  choiceLabel(choice.text, choice.is_abstain, locale)
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{choice.vote_count ?? 0}</td>
              <td className={`py-2 pr-3 text-right tabular-nums ${deciding === "shareOfAll" ? "font-semibold" : ""}`}>
                {formatPercent(choice.percent_of_total_ownership ?? choice.ownership)}
              </td>
              <td className={`py-2 text-right tabular-nums ${deciding === "shareOfCast" ? "font-semibold" : ""}`}>
                {formatPercent(choice.percent_of_submitted_ownership)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
