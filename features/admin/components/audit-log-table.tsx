"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useMemo, useState } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { SearchSelect } from "@/features/ui/search-select";
import { AuditActionFilter } from "@/features/admin/components/sections/setup/audit-log-action-filter";
import {
  AuditLogRows,
  type AuditLogRow,
} from "@/features/admin/components/sections/setup/audit-log-rows";

type AuditActorOption = {
  id: string;
  label: string;
  /** Shown under the name, and searchable (null when the label is the email). */
  email?: string | null;
};

type AuditLogFilters = {
  actions: string[];
  actor: string;
  dir: "asc" | "desc";
  from: string;
  page: number;
  perPage: number;
  sort: "action" | "actor" | "entity" | "time";
  to: string;
};

type AuditLogTableProps = {
  actions: string[];
  actors: AuditActorOption[];
  initialFilters: AuditLogFilters;
  initialPage: number;
  initialPerPage: number;
  initialRows: AuditLogRow[];
  initialTotal: number;
  /** Where the rows come from (the audit page uses /api/audit/logs). */
  endpoint?: string;
  /** Fixed params kept in the URL and sent with every load, e.g. the tab
   * and the audit page's meeting (req_0007). */
  baseParams?: Record<string, string>;
};

const SETUP_PARAMS: Record<string, string> = { tab: "audit" };

type AuditApiResponse = {
  auditLogPage: number;
  auditLogPerPage: number;
  auditLogTotal: number;
  auditLogs: AuditLogRow[];
};

function buildParams(filters: AuditLogFilters, baseParams: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(baseParams)) {
    if (value) {
      params.set(key, value);
    }
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (filters.actor) {
    params.set("actor", filters.actor);
  }

  filters.actions.forEach((action) => params.append("actions", action));
  params.set("sort", filters.sort);
  params.set("dir", filters.dir);

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  params.set("perPage", String(filters.perPage));

  return params;
}

function syncUrl(filters: AuditLogFilters, baseParams: Record<string, string>) {
  const params = buildParams(filters, baseParams);
  window.history.replaceState(null, "", `?${params.toString()}`);
}

export function AuditLogTable({
  actions,
  actors,
  initialFilters,
  initialPage,
  initialPerPage,
  initialRows,
  initialTotal,
  endpoint = "/api/admin/audit-logs",
  baseParams = SETUP_PARAMS,
}: AuditLogTableProps) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const [criteria, setCriteria] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Everyone who appears in the log can be many people: type to search
  // (UI standard rule 8). An empty choice means all actors.
  const actorOptions = useMemo(
    () =>
      actors.map((actor) => ({
        value: actor.id,
        label: actor.label,
        hint: actor.email ?? undefined,
        keywords: actor.email ?? undefined,
      })),
    [actors],
  );
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  async function load(nextFilters: AuditLogFilters) {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams(nextFilters, baseParams);
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(s.setup.auditLoadFailed);
      }

      const payload = (await response.json()) as AuditApiResponse;

      setRows(payload.auditLogs);
      setPage(payload.auditLogPage);
      setPerPage(payload.auditLogPerPage);
      setTotal(payload.auditLogTotal);
      setAppliedFilters({
        ...nextFilters,
        page: payload.auditLogPage,
        perPage: payload.auditLogPerPage,
      });
      setCriteria({
        ...nextFilters,
        page: payload.auditLogPage,
        perPage: payload.auditLogPerPage,
      });
      syncUrl(
        {
          ...nextFilters,
          page: payload.auditLogPage,
          perPage: payload.auditLogPerPage,
        },
        baseParams,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : s.setup.auditLoadFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.setup.auditFilter}
          </p>
        </div>
        <form
          className="grid gap-3 lg:grid-cols-12"
          onSubmit={(event) => {
            event.preventDefault();
            void load({ ...criteria, page: 1, perPage });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
            {s.common.from}
            <input
              className="min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  from: value,
                }));
              }}
              step={600}
              type="datetime-local"
              value={criteria.from}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
            {s.common.to}
            <input
              className="min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  to: value,
                }));
              }}
              step={600}
              type="datetime-local"
              value={criteria.to}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
            {s.common.actor}
            <span className="text-[var(--foreground)]">
              <SearchSelect
                defaultValue={criteria.actor}
                name="actor"
                onChange={(value) =>
                  setCriteria((current) => ({
                    ...current,
                    actor: value,
                  }))
                }
                options={actorOptions}
                text={{
                  clear: s.common.searchClear,
                  more: s.common.searchMore,
                  noResults: s.common.searchNoResults,
                  placeholder: s.setup.allActors,
                }}
              />
            </span>
          </label>
          <div className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-8">
            <AuditActionFilter
              actions={actions}
              onChange={(selected) => setCriteria((current) => ({ ...current, actions: selected }))}
              selected={criteria.actions}
            />
          </div>
          <div className="flex flex-wrap items-end justify-center gap-2 lg:col-span-4">
            <PendingSubmitButton
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              pendingLabel={s.common.searching}
              type="submit"
            >
              {s.common.search}
            </PendingSubmitButton>
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              onClick={() => {
                const nextFilters: AuditLogFilters = {
                  actions: [],
                  actor: "",
                  dir: "desc",
                  from: "",
                  page: 1,
                  perPage: 25,
                  sort: "time",
                  to: "",
                };

                void load(nextFilters);
              }}
              type="button"
            >
              {s.common.clear}
            </button>
          </div>
        </form>
      </section>

      <section
        aria-busy={loading}
        className="relative mt-5 rounded-md border border-[var(--border)] bg-[var(--surface)]"
      >
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/70 pt-16 text-sm font-medium text-[var(--muted)]">
            {s.common.loadingResults}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{s.common.results}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {fill(s.common.showing, { start: pageStart, end: pageEnd, total: total })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span>{s.common.page}</span>
              <select
                aria-label={s.common.page}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={loading || totalPages <= 1}
                onChange={(event) => {
                  const nextPage = Number(event.currentTarget.value);

                  void load({
                    ...appliedFilters,
                    page: Number.isInteger(nextPage) && nextPage > 0 ? nextPage : 1,
                  });
                }}
                value={String(page)}
              >
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {pageNumber}
                    </option>
                  ),
                )}
              </select>
              <span>{fill(s.common.ofPages, { total: totalPages })}</span>
            </label>
            <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span>{s.common.perPage}</span>
              <select
                aria-label={s.common.perPage}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={loading}
                onChange={(event) => {
                  const nextPerPage = Number(event.currentTarget.value);

                  void load({
                    ...appliedFilters,
                    page: 1,
                    perPage: Number.isFinite(nextPerPage) ? nextPerPage : 25,
                  });
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
        </div>
        {error ? (
          <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {tm(error)}
          </p>
        ) : null}
        <AuditLogRows
          dir={appliedFilters.dir}
          onSort={(nextSort) => {
            const nextDir =
              appliedFilters.sort === nextSort && appliedFilters.dir === "asc" ? "desc" : "asc";

            void load({ ...appliedFilters, dir: nextDir, page: 1, sort: nextSort });
          }}
          rows={rows}
          sort={appliedFilters.sort}
        />
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            {s.setup.noAudit}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() =>
              void load({ ...appliedFilters, page: Math.max(1, page - 1) })
            }
            type="button"
          >
            {s.common.previous}
          </button>
          <div className="text-sm text-[var(--muted)]">
            {pageStart}-{pageEnd} / {total}
          </div>
          <button
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() =>
              void load({ ...appliedFilters, page: Math.min(totalPages, page + 1) })
            }
            type="button"
          >
            {s.common.next}
          </button>
        </div>
      </section>
    </div>
  );
}
