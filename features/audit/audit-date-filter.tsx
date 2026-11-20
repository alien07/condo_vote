import { auditHref } from "@/features/audit/audit-href";
import type { AuditListFilters, AuditTab } from "@/features/audit/data";
import { getStaffI18n } from "@/lib/i18n/server";

const inputClass =
  "min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

/** The standard filter panel of a tab: a date range (Bangkok days), kept
 * in the URL with the meeting (req_0007). */
export async function AuditDateFilter({
  description,
  filters,
  tab,
}: {
  description: string;
  filters: AuditListFilters;
  tab: AuditTab;
}) {
  const { s } = await getStaffI18n();

  return (
    <section className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
      <form action="/audit" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input name="tab" type="hidden" value={tab} />
        {filters.meeting ? <input name="meeting" type="hidden" value={filters.meeting} /> : null}
        {filters.perPage !== 25 ? <input name="perPage" type="hidden" value={filters.perPage} /> : null}
        <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-4">
          {s.audit.from}
          <input className={inputClass} defaultValue={filters.from} name="from" type="date" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-4">
          {s.audit.to}
          <input className={inputClass} defaultValue={filters.to} name="to" type="date" />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            className="min-h-11 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            type="submit"
          >
            {s.common.search}
          </button>
          <a
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
            href={auditHref({ tab, meeting: filters.meeting })}
          >
            {s.common.clear}
          </a>
        </div>
      </form>
    </section>
  );
}
