import { LongText } from "@/features/ui/long-text";
import { AuditDateFilter } from "@/features/audit/audit-date-filter";
import { AuditPager } from "@/features/audit/audit-pager";
import type { AuditListFilters, fetchAuditCorrections } from "@/features/audit/data";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";

type Corrections = Awaited<ReturnType<typeof fetchAuditCorrections>>;

const badge = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";
// Level and status as colour badges (req_0007 item 6). The committee page
// marks a high level in red; the rest follows the results page colours.
const LEVEL_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-800",
};
const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  fixed: "bg-emerald-100 text-emerald-800",
  no_change: "bg-slate-100 text-slate-700",
};

/** Correction requests: meeting first, level and status as badges, who
 * asked and when, the reason and the answer with readable labels. */
export async function CorrectionsTab({ data, filters }: { data: Corrections; filters: AuditListFilters }) {
  const { locale, s } = await getStaffI18n();
  const t = s.audit;
  const c = s.committee;
  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

  return (
    <>
      <AuditDateFilter description={t.correctionsFilter} filters={filters} tab="corrections" />
      <AuditPager filters={filters} position="top" tab="corrections" total={data.total} />
      {data.rows.length ? (
        <ul className="grid gap-2" data-audit-corrections>
          {data.rows.map((row) => {
            const requester = one(row.requester);

            return (
              <li
                className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                data-correction-id={row.id}
                key={row.id}
              >
                <div className="font-medium [overflow-wrap:anywhere]">{one(row.meetings)?.title ?? "-"}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${badge} ${LEVEL_BADGE[row.level] ?? LEVEL_BADGE.low}`} data-level={row.level}>
                    {t.level}: {codeLabel(c.levels, row.level)}
                  </span>
                  <span className={`${badge} ${STATUS_BADGE[row.status] ?? STATUS_BADGE.no_change}`} data-status={row.status}>
                    {codeLabel(c.correctionStatus, row.status)}
                  </span>
                  <span className="text-sm">{codeLabel(c.categories, row.category)}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {fill(t.requestedBy, {
                    name: requester?.full_name ?? requester?.email ?? "-",
                    date: formatDateTimeIn(locale, row.created_at),
                  })}
                </p>
                <div>
                  <p className="text-sm font-medium">{t.reason}</p>
                  <LongText less={c.showLess} more={c.showMore} text={row.reason} />
                </div>
                {row.answer ? (
                  <div>
                    <p className="text-sm font-medium">
                      {t.answer}
                      {row.answered_at ? (
                        <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                          {fill(t.answeredAt, { date: formatDateTimeIn(locale, row.answered_at) })}
                        </span>
                      ) : null}
                    </p>
                    <LongText less={c.showLess} more={c.showMore} text={row.answer} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">{t.none}</p>
      )}
      <AuditPager filters={filters} position="bottom" tab="corrections" total={data.total} />
    </>
  );
}
