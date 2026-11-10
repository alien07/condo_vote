// Per-choice totals of one question from a result snapshot. Used on the
// Summary page and on the Committee page, so both read the same way.

export type ChoiceResult = {
  id?: string;
  text?: string;
  vote_count?: number;
  ownership?: number;
  percent_of_submitted_ownership?: number;
};

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

const LABELS = {
  en: { empty: "No votes were recorded for this item.", choice: "Choice", rooms: "Rooms", ownership: "Ownership", cast: "Of votes cast" },
  th: { empty: "ไม่มีการลงคะแนนในวาระนี้", choice: "ตัวเลือก", rooms: "ห้อง", ownership: "คะแนนเสียง", cast: "% ของผู้ลงคะแนน" },
};

export function ChoiceResultsTable({
  choices,
  lang = "en",
}: {
  choices?: ChoiceResult[];
  lang?: keyof typeof LABELS;
}) {
  const label = LABELS[lang];

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
              <td className="py-2 pr-3">{choice.text ?? "-"}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{choice.vote_count ?? 0}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatPercent(choice.ownership)}
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
