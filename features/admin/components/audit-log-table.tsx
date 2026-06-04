"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type AuditActorOption = {
  id: string;
  label: string;
};

type AuditLogRow = {
  action: string;
  created_at: string;
  details_json: unknown;
  entity_id: string | null;
  entity_type: string;
  id: string;
  profiles: {
    email: string | null;
    full_name: string | null;
    id: string;
  } | null;
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
};

type AuditApiResponse = {
  auditLogPage: number;
  auditLogPerPage: number;
  auditLogTotal: number;
  auditLogs: AuditLogRow[];
};

function formatAuditDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

function buildParams(filters: AuditLogFilters) {
  const params = new URLSearchParams();

  params.set("tab", "audit");

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

function syncUrl(filters: AuditLogFilters) {
  const params = buildParams(filters);
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
}: AuditLogTableProps) {
  const [criteria, setCriteria] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  async function load(nextFilters: AuditLogFilters) {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams(nextFilters);
      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Could not load audit logs.");
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
      syncUrl({
        ...nextFilters,
        page: payload.auditLogPage,
        perPage: payload.auditLogPerPage,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Search Criteria</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter audit events by time range, actor, and action. Results update
            without reloading the whole page.
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
            From
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
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
            To
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
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
            Actor
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  actor: value,
                }));
              }}
              value={criteria.actor}
            >
              <option value="">All actors</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-8">
            Actions
            <select
              className="min-h-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              multiple
              onChange={(event) => {
                const selected = Array.from(
                  event.currentTarget.selectedOptions,
                ).map((option) => option.value);

                setCriteria((current) => ({ ...current, actions: selected }));
              }}
              value={criteria.actions}
            >
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 lg:col-span-4">
            <PendingSubmitButton
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              pendingLabel="Searching..."
              type="submit"
            >
              Search
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
              Clear
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
            Loading results...
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Results</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span>Page</span>
              <select
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
              <span>of {totalPages}</span>
            </label>
            <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span>Per page</span>
              <select
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
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                {[
                  ["time", "Time"],
                  ["actor", "Actor"],
                  ["action", "Action"],
                  ["entity", "Entity"],
                ].map(([sort, label]) => (
                  <th
                    className={
                      sort === "time"
                        ? "w-32 min-w-32 px-4 py-3 font-medium"
                        : "px-4 py-3 font-medium"
                    }
                    key={sort}
                  >
                    <button
                      className="font-medium"
                      onClick={() => {
                        const nextSort = sort as AuditLogFilters["sort"];
                        const nextDir =
                          appliedFilters.sort === nextSort &&
                          appliedFilters.dir === "asc"
                            ? "desc"
                            : "asc";

                        void load({
                          ...appliedFilters,
                          dir: nextDir,
                          page: 1,
                          sort: nextSort,
                        });
                      }}
                      type="button"
                    >
                      {label}
                      {appliedFilters.sort === sort
                        ? appliedFilters.dir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log, index) => {
                const timestamp = formatAuditDateTime(log.created_at);

                return (
                  <tr
                    className={[
                      "border-b border-[var(--border)] last:border-0",
                      index % 2 === 0
                        ? "bg-[var(--surface)]"
                        : "bg-[var(--background)]",
                    ].join(" ")}
                    key={log.id}
                  >
                    <td className="w-32 min-w-32 px-4 py-3 text-xs tabular-nums">
                      <div>{timestamp.date}</div>
                      <div className="text-[var(--muted)]">{timestamp.time}</div>
                    </td>
                    <td className="px-4 py-3">
                      {log.profiles?.full_name ?? log.profiles?.email ?? "-"}
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.entity_type}</td>
                    <td className="max-w-sm truncate px-4 py-3">
                      {JSON.stringify(log.details_json)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            No audit log rows match the selected criteria.
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
            Previous
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
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
