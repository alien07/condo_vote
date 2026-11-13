// Per-choice totals of one question from a result snapshot. Used on the
// Summary page and on the Committee page, so both read the same way.

import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { choiceLabel } from "@/lib/i18n/choice";

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
}: {
  choices?: ChoiceResult[];
  locale?: Locale;
}) {
  const t = getDictionary(locale).results;
  const label = {
    empty: t.noVotes,
    choice: t.choice,
    rooms: t.rooms,
    ownership: t.shareOfAll,
    cast: t.shareOfCast,
  };

  if (!choices || choices.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">{label.empty}</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-[var(--border)] text-[var(--muted)]">
          <tr>
            <th className="py-2 pr-3 font-medium">{label.choice}</th>
            <th className="py-2 pr-3 text-right font-medium">{label.rooms}</th>
            <th className="py-2 pr-3 text-right font-medium">{label.ownership}</th>
            <th className="py-2 text-right font-medium">{label.cast}</th>
          </tr>
        </thead>
        <tbody>
          {choices.map((choice, index) => (
            <tr
              className="border-b border-[var(--border)] last:border-0"
              key={choice.id ?? `${choice.text}-${index}`}
            >
              <td className="py-2 pr-3">{choiceLabel(choice.text, choice.is_abstain, locale)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{choice.vote_count ?? 0}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatPercent(choice.percent_of_total_ownership ?? choice.ownership)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatPercent(choice.percent_of_submitted_ownership)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
