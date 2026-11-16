"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";

// One card per admin list: title and actions, the filters in a band, the
// result count with paging, the table, then paging again at the bottom
// (UI review 2026-11-17). Pages pass their own fields and rows.
//
// Search feedback (2026-11-17): every search shows that it finished — the
// count ("Found 12 of 70"), the filters in use as removable chips, and a
// short fade of the results. Lists that wait on the server also pass
// `loading` (see useListLoading): the Search button spins and the old
// results dim under a moving bar. Lists filtered in the browser answer at
// once, so they get no loading state and no added delay.

/** A filter in use, shown as a chip that removes it. */
export type ListFilter = { key: string; label: string; onRemove: () => void };

/**
 * Turns "a search is running" into "show the loading state" without a
 * flash: nothing shows for answers faster than `delay`, and once shown it
 * stays at least `minimum` ms.
 */
export function useListLoading(
  pending: boolean,
  { delay = 150, minimum = 300 }: { delay?: number; minimum?: number } = {},
) {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (pending) {
      if (shown) {
        return;
      }
      const timer = window.setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, delay);
      return () => window.clearTimeout(timer);
    }
    if (!shown) {
      return;
    }
    const wait = Math.max(0, minimum - (Date.now() - shownAt.current));
    const timer = window.setTimeout(() => setShown(false), wait);
    return () => window.clearTimeout(timer);
  }, [delay, minimum, pending, shown]);

  return shown;
}

/** Briefly fades the results in whenever `resultKey` changes (not on first paint). */
function useResultFade(resultKey: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const lastKey = useRef(resultKey);

  useEffect(() => {
    if (resultKey === lastKey.current) {
      return;
    }
    lastKey.current = resultKey;
    const element = ref.current;
    if (
      !element ||
      typeof element.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    element.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
  }, [resultKey]);

  return ref;
}

export const listTableClass = "w-full border-collapse text-left text-sm";
export const listTheadClass =
  "border-y border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[var(--muted)]";
export const listThClass = "whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5";
export const listTdClass = "px-3 py-2.5 first:pl-5 last:pr-5 align-middle";
export const listRowClass = "border-b border-[var(--border)] last:border-b-0";
/** Row actions stay on one line; on a narrow screen the table scrolls sideways. */
export const listActionsClass = "flex flex-nowrap items-center gap-1 whitespace-nowrap";
/** Numbers line up on the right and keep equal digit widths. */
export const listNumericClass = "text-right tabular-nums";
export const listRowButtonClass =
  "inline-flex min-h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium";
/** A second, rarer row action: quiet until hovered, red only on hover. */
export const listQuietDangerButtonClass =
  "inline-flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--danger-surface)] hover:text-[var(--danger)]";
export const listQuietButtonClass =
  "inline-flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--background)]";
export const listInputClass =
  "min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";
export const listFieldClass = "grid gap-1 text-xs font-medium text-[var(--muted)]";

export function AdminListCard({
  actions,
  children,
  description,
  filters,
  footer,
  icon,
  loading = false,
  meta,
  pager,
  resultKey,
  title,
  toolbar,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  /** Filters in use, shown as removable chips next to the count. */
  filters?: ListFilter[];
  footer?: ReactNode;
  icon?: ReactNode;
  /** True while a search waits on the server (pass useListLoading's result). */
  loading?: boolean;
  /** Result count, for example "Showing 1-25 of 66". */
  meta?: string;
  pager?: ReactNode;
  /** Changes whenever a search, sort or page change gives new results. */
  resultKey?: string;
  title: string;
  toolbar?: ReactNode;
}) {
  const { s } = useStaffText();
  const resultsRef = useResultFade(resultKey);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <span className="mt-0.5 text-[var(--primary)]">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {toolbar ? (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
          {toolbar}
        </div>
      ) : null}
      {meta || pager || filters?.length ? (
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          {loading ? (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
            >
              <div className="list-progress h-full w-2/5 bg-[var(--primary)]" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <p aria-live="polite" className="text-sm text-[var(--muted)]">
              {meta}
            </p>
            {filters?.length ? (
              <ul aria-label={s.common.activeFilters} className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <li key={filter.key}>
                    <button
                      aria-label={fill(s.common.removeFilter, { label: filter.label })}
                      className="tap-target inline-flex min-h-7 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] pr-2 pl-3 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)]"
                      onClick={filter.onRemove}
                      type="button"
                    >
                      {filter.label}
                      <X aria-hidden="true" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {pager}
        </div>
      ) : null}
      <div
        aria-busy={loading || undefined}
        className={[
          "overflow-x-auto transition-opacity",
          loading ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
        ref={resultsRef}
      >
        {children}
      </div>
      {footer ? (
        <div className="border-t border-[var(--border)] px-5 py-3">{footer}</div>
      ) : null}
    </section>
  );
}

/** Filters in one row: the fields, then Search and Clear next to them. */
export function AdminListToolbar({
  children,
  loading = false,
  onClear,
  onSubmit,
}: {
  children: ReactNode;
  /** True while a search waits on the server: the button spins and waits. */
  loading?: boolean;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const { s } = useStaffText();

  return (
    <form
      aria-label={s.common.searchCriteria}
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!loading) {
          onSubmit();
        }
      }}
      role="search"
    >
      {children}
      <div className="flex gap-2">
        <button
          aria-disabled={loading || undefined}
          className="inline-flex min-h-10 min-w-24 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)] aria-disabled:opacity-80"
          type="submit"
        >
          {loading ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />
              {s.common.searching}
            </>
          ) : (
            s.common.search
          )}
        </button>
        <button
          className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          onClick={onClear}
          type="button"
        >
          {s.common.clear}
        </button>
      </div>
    </form>
  );
}

/** Page and page-size pickers for the result row. */
export function AdminListPager({
  onPage,
  onPerPage,
  page,
  perPage,
  totalPages,
}: {
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
  page: number;
  perPage: number;
  totalPages: number;
}) {
  const { s } = useStaffText();
  const selectClass =
    "rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]";

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--muted)]">
      <label className="flex items-center gap-2">
        <span>{s.common.page}</span>
        <select
          aria-label={s.common.page}
          className={selectClass}
          disabled={totalPages <= 1}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            onPage(Number.isInteger(next) && next > 0 ? next : 1);
          }}
          value={String(page)}
        >
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <option key={pageNumber} value={pageNumber}>
              {pageNumber}
            </option>
          ))}
        </select>
        <span>{fill(s.common.ofPages, { total: totalPages })}</span>
      </label>
      <label className="flex items-center gap-2">
        <span>{s.common.perPage}</span>
        <select
          aria-label={s.common.perPage}
          className={selectClass}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            onPerPage(Number.isInteger(next) ? next : 25);
          }}
          value={String(perPage)}
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </label>
    </div>
  );
}

/** Previous / next under the table, so a long page need not scroll back up. */
export function AdminListFooterPager({
  end,
  onPage,
  page,
  start,
  total,
  totalPages,
}: {
  end: number;
  onPage: (page: number) => void;
  page: number;
  start: number;
  total: number;
  totalPages: number;
}) {
  const { s } = useStaffText();
  const buttonClass =
    "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        type="button"
      >
        {s.common.previous}
      </button>
      <div className="text-sm text-[var(--muted)] tabular-nums">
        {start}-{end} / {total}
      </div>
      <button
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        type="button"
      >
        {s.common.next}
      </button>
    </div>
  );
}

/** No rows: say so, and offer to drop the filters when some are in use. */
export function AdminListEmpty({
  message,
  onClearFilters,
}: {
  message: string;
  onClearFilters?: () => void;
}) {
  const { s } = useStaffText();

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {onClearFilters ? (
        <button
          className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          onClick={onClearFilters}
          type="button"
        >
          {s.common.clearFilters}
        </button>
      ) : null}
    </div>
  );
}

/** Sortable column header with the direction arrow. */
export function SortHeader({
  active,
  dir,
  label,
  numeric = false,
  onSort,
}: {
  active: boolean;
  dir: "asc" | "desc";
  label: string;
  numeric?: boolean;
  onSort: () => void;
}) {
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={[listThClass, numeric ? "text-right" : ""].join(" ")}
      scope="col"
    >
      <button className="font-semibold" onClick={onSort} type="button">
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
