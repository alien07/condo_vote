import { LongText } from "@/features/ui/long-text";
import type { CommitteeOverview } from "@/features/results/committee-service";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { codeLabel, fill } from "@/lib/i18n/template";

type Correction = CommitteeOverview["pending_results"][number]["corrections"][number];

function CorrectionBox({
  correction,
  formatDateTime,
  t,
}: {
  correction: Correction;
  formatDateTime: (value: string) => string;
  t: StaffDictionary["committee"];
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        correction.level === "high" ? "border-[var(--danger)]" : "border-[var(--border)]"
      }`}
    >
      <div className="font-medium">
        {codeLabel(t.categories, correction.category)} ·{" "}
        {fill(t.correctionLevel, { level: codeLabel(t.levels, correction.level) })} ·{" "}
        {codeLabel(t.correctionStatus, correction.status)}
      </div>
      <div className="text-[var(--muted)]">
        {fill(t.correctionBy, { name: correction.requester ?? "-", time: formatDateTime(correction.created_at) })}
      </div>
      <div className="mt-1 grid gap-1">
        <LongText label={t.labelReason} less={t.showLess} more={t.showMore} text={correction.reason} />
        {correction.legal_reference ? (
          <LongText label={t.labelReference} less={t.showLess} lines={2} more={t.showMore} text={correction.legal_reference} />
        ) : null}
        {correction.level_change_reason ? (
          <LongText label={t.labelLevelRaised} less={t.showLess} lines={2} more={t.showMore} text={correction.level_change_reason} />
        ) : null}
        {correction.answer ? (
          <LongText label={t.labelAnswer} less={t.showLess} more={t.showMore} text={correction.answer} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Correction requests of a result (UI review 2026-11-15): the open one in
 * full, since it needs attention; answered ones folded into one line.
 */
export function ResultCorrections({
  corrections,
  formatDateTime,
  t,
}: {
  corrections: Correction[];
  formatDateTime: (value: string) => string;
  t: StaffDictionary["committee"];
}) {
  const open = corrections.filter((correction) => correction.status === "open");
  const answered = corrections.filter((correction) => correction.status !== "open");

  if (corrections.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm" data-corrections>
      {open.length > 0 ? <div className="font-medium">{t.correctionsTitle}</div> : null}
      {open.map((correction) => (
        <CorrectionBox correction={correction} formatDateTime={formatDateTime} key={correction.id} t={t} />
      ))}
      {answered.length > 0 ? (
        <details data-corrections-answered>
          <summary className="tap-target cursor-pointer text-xs text-[var(--muted)]">
            {fill(t.answeredCorrections, { count: answered.length })}
          </summary>
          <div className="mt-2 grid gap-2">
            {answered.map((correction) => (
              <CorrectionBox correction={correction} formatDateTime={formatDateTime} key={correction.id} t={t} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
