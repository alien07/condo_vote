"use client";

import type { FormEvent, ReactNode } from "react";
import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";

// One card per admin list: title and actions, the filters in a band, the
// result count with paging, the table, then paging again at the bottom
// (UI review 2026-11-17). Pages pass their own fields and rows.

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
  footer,
  icon,
  meta,
  pager,
  title,
  toolbar,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  /** Result count, for example "Showing 1-25 of 66". */
  meta?: string;
  pager?: ReactNode;
  title: string;
  toolbar?: ReactNode;
}) {
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
      {meta || pager ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <p aria-live="polite" className="text-sm text-[var(--muted)]">
            {meta}
          </p>
          {pager}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="border-t border-[var(--border)] px-5 py-3">{footer}</div>
      ) : null}
    </section>
  );
}

/** Filters in one row: the fields, then Search and Clear next to them. */
export function AdminListToolbar({
  children,
  onClear,
  onSubmit,
}: {
  children: ReactNode;
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
        onSubmit();
      }}
      role="search"
    >
      {children}
      <div className="flex gap-2">
        <button
          className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          type="submit"
        >
          {s.common.search}
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
