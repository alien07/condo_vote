import { PerPageSelect } from "@/features/admin/components/table-controls";
import { auditHref } from "@/features/audit/audit-href";
import type { AuditListFilters, AuditTab } from "@/features/audit/data";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

const linkClass = "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium";

/** "Showing 1-25 of 80", page and per page, previous / next: server-side
 * paging through every row (no fixed limit, req_0007). */
export async function AuditPager({
  filters,
  position,
  tab,
  total,
}: {
  filters: AuditListFilters;
  position: "top" | "bottom";
  tab: AuditTab;
  total: number;
}) {
  const { s } = await getStaffI18n();
  const totalPages = Math.max(1, Math.ceil(total / filters.perPage));
  const page = Math.min(filters.page, totalPages);
  const start = total === 0 ? 0 : (page - 1) * filters.perPage + 1;
  const end = Math.min(page * filters.perPage, total);
  const href = (changes: Partial<AuditListFilters>) => auditHref({ tab, ...filters, page, ...changes });

  if (position === "top") {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">{fill(s.common.showing, { start, end, total })}</p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label={s.common.page}
            options={Array.from({ length: totalPages }, (_, index) => index + 1)}
            urlByValue={Object.fromEntries(
              Array.from({ length: totalPages }, (_, index) => [String(index + 1), href({ page: index + 1 })]),
            )}
            value={page}
          />
          <span className="text-xs font-medium text-[var(--muted)]">{fill(s.common.ofPages, { total: totalPages })}</span>
          <PerPageSelect
            label={s.common.perPage}
            urlByValue={Object.fromEntries([10, 25, 50, 100].map((perPage) => [String(perPage), href({ page: 1, perPage })]))}
            value={filters.perPage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <a
        aria-disabled={page <= 1}
        className={`${linkClass} ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        href={href({ page: Math.max(1, page - 1) })}
      >
        {s.common.previous}
      </a>
      <span className="text-sm text-[var(--muted)]">
        {start}-{end} / {total}
      </span>
      <a
        aria-disabled={page >= totalPages}
        className={`${linkClass} ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        href={href({ page: Math.min(totalPages, page + 1) })}
      >
        {s.common.next}
      </a>
    </div>
  );
}
