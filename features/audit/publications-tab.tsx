import { AuditDateFilter } from "@/features/audit/audit-date-filter";
import { AuditPager } from "@/features/audit/audit-pager";
import type { AuditListFilters } from "@/features/audit/data";
import type { fetchAuditPublications } from "@/features/audit/data";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

const buttonClass =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm font-medium text-[var(--primary)]";

type Publications = Awaited<ReturnType<typeof fetchAuditPublications>>;

/** Published results: meeting, when, how many approved, the web record and
 * the official PDF when it exists (req_0007 items 3-5). */
export async function PublicationsTab({ data, filters }: { data: Publications; filters: AuditListFilters }) {
  const { locale, s } = await getStaffI18n();
  const t = s.audit;
  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

  return (
    <>
      <AuditDateFilter description={t.resultsFilter} filters={filters} tab="results" />
      <AuditPager filters={filters} position="top" tab="results" total={data.total} />
      {data.rows.length ? (
        <ul className="grid gap-2" data-audit-publications>
          {data.rows.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              data-publication-id={row.id}
              key={row.id}
            >
              <div className="grid min-w-0 gap-0.5">
                <span className="font-medium [overflow-wrap:anywhere]">{one(row.meetings)?.title ?? "-"}</span>
                <span className="text-xs text-[var(--muted)]">
                  {fill(t.publishedAt, { date: formatDateTimeIn(locale, row.published_at) })} ·{" "}
                  {fill(t.approvedBy, { count: row.approvals_count })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <a className={buttonClass} href={`/record/${row.result_snapshot_id}?from=audit`}>
                  {t.officialRecord}
                </a>
                {row.hasOfficialPdf ? (
                  <a className={buttonClass} href={`/result-files/${row.result_snapshot_id}/official-th.pdf`}>
                    {t.officialPdf}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">{t.none}</p>
      )}
      <AuditPager filters={filters} position="bottom" tab="results" total={data.total} />
    </>
  );
}
