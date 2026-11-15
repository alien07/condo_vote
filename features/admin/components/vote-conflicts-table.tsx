"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { codeLabel, fill } from "@/lib/i18n/template";
import { useEffect, useState } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import {
  type VoteConflictRow,
  type ConflictFilters,
  type ConflictApiResponse,
  type VoteConflictsTableProps,
  buildParams,
  syncUrl,
  formatDateTime,
  escapeSelectorValue,
  conflictQuestionRows,
} from "@/features/admin/components/vote-conflicts/conflict-helpers";
import {
  ResolveConflictForm,
} from "@/features/admin/components/vote-conflicts/resolve-conflict-form";

export type { VoteConflictRow } from "@/features/admin/components/vote-conflicts/conflict-helpers";

export function VoteConflictsTable({
  initialFilters,
  initialPage,
  initialPerPage,
  initialRows,
  initialTotal,
}: VoteConflictsTableProps) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const [criteria, setCriteria] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<VoteConflictRow | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);
  const selectedRowKey = selected?.key ?? null;

  async function load(nextFilters: ConflictFilters) {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams(nextFilters);
      const response = await fetch(
        `/api/admin/vote-conflicts?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );

      if (!response.ok) {
        throw new Error(s.voting.loadFailed);
      }

      const payload = (await response.json()) as ConflictApiResponse;
      const normalizedFilters = {
        ...nextFilters,
        page: payload.conflictPage,
        perPage: payload.conflictPerPage,
      };

      setRows(payload.conflicts);
      setPage(payload.conflictPage);
      setPerPage(payload.conflictPerPage);
      setTotal(payload.conflictTotal);
      setAppliedFilters(normalizedFilters);
      setCriteria(normalizedFilters);
      syncUrl(normalizedFilters);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : s.voting.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  function sortBy(sort: ConflictFilters["sort"]) {
    const dir =
      appliedFilters.sort === sort && appliedFilters.dir === "asc"
        ? "desc"
        : "asc";

    void load({ ...appliedFilters, dir, page: 1, sort });
  }

  async function handleResolved(recordKey: string) {
    setFocusedKey(recordKey);
    setMessage(s.voting.resolved);
    setSelected(null);
    await load(appliedFilters);
  }

  useEffect(() => {
    if (!focusedKey) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-conflict-key="${escapeSelectorValue(focusedKey)}"]`,
      );

      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [focusedKey, rows]);

  return (
    <div>
      <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{s.common.searchCriteria}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.voting.conflictsFilter}
          </p>
        </div>
        <form
          className="grid gap-3 md:grid-cols-12"
          onSubmit={(event) => {
            event.preventDefault();
            void load({ ...criteria, page: 1, perPage });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.voting.meeting}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  meeting: value,
                }));
              }}
              placeholder={s.voting.searchMeeting}
              value={criteria.meeting}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.voting.room}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  room: value,
                }));
              }}
              placeholder={s.voting.searchRoom}
              value={criteria.room}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.status}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  status: value,
                }));
              }}
              value={criteria.status}
            >
              <option value="all">{s.common.allStatuses}</option>
              <option value="unresolved">{s.voting.unresolvedOption}</option>
              <option value="resolved">{s.voting.resolvedOption}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
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
                const nextFilters: ConflictFilters = {
                  dir: "asc",
                  meeting: "",
                  page: 1,
                  perPage: 25,
                  room: "",
                  sort: "meeting",
                  status: "all",
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
            <h2 className="text-sm font-semibold">{s.common.results}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {fill(s.common.showing, { start: pageStart, end: pageEnd, total: total })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              {s.common.page}
              <select
                aria-label={s.common.page}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={loading || totalPages <= 1}
                onChange={(event) =>
                  void load({
                    ...appliedFilters,
                    page: Number(event.currentTarget.value),
                  })
                }
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
              {s.common.perPage}
              <select
                aria-label={s.common.perPage}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={loading}
                onChange={(event) =>
                  void load({
                    ...appliedFilters,
                    page: 1,
                    perPage: Number(event.currentTarget.value),
                  })
                }
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
        {message ? (
          <div className="border-b border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {tm(message)}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                {[
                  ["meeting", s.voting.meeting],
                  ["room", s.voting.room],
                  ["status", s.common.status],
                  ["resolved_at", s.voting.resolvedAt],
                ].map(([sort, label]) => (
                  <th className="px-4 py-3 font-medium" key={sort}>
                    <button
                      className="font-medium"
                      onClick={() => sortBy(sort as ConflictFilters["sort"])}
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
                <th className="px-4 py-3 font-medium">{s.common.action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((conflict, index) => {
                const highlighted =
                  selectedRowKey === conflict.key || focusedKey === conflict.key;

                return (
                  <tr
                    className={[
                      "border-b border-[var(--border)] outline-none last:border-0 focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                      highlighted
                        ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                        : index % 2 === 0
                          ? "bg-[var(--surface)]"
                          : "bg-[var(--background)]",
                    ].join(" ")}
                    data-conflict-key={conflict.key}
                    key={conflict.key}
                    tabIndex={-1}
                  >
                    <td className="px-4 py-3">{conflict.meetingTitle}</td>
                    <td className="px-4 py-3">{conflict.roomNumber}</td>
                    <td className="px-4 py-3">{codeLabel(s.common.code, conflict.status)}</td>
                    <td className="px-4 py-3">
                      {formatDateTime(conflict.resolution?.resolved_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                        onClick={() => setSelected(conflict)}
                        type="button"
                      >
                        {s.voting.reviewResolve}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            {s.voting.noConflicts}
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

      {selected ? (
        <div
          aria-label={s.voting.reviewDialog}
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="dialog"
        >
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{s.voting.reviewConflict}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selected.meetingTitle} / room {selected.roomNumber}
                </p>
              </div>
              <button
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                onClick={() => setSelected(null)}
                type="button"
              >
                {s.common.close}
              </button>
            </div>
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {s.voting.readOnlyHelp}
            </p>
            <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <p className="font-medium">{s.voting.manualIdentity}</p>
              <p className="mt-1 text-[var(--muted)]">
                {selected.manualIdentityStatus} /{" "}
                {selected.manualVoterIdentityText ??
                  selected.manualVoterProfileId ??
                  "identity not captured"}
              </p>
            </div>
            {selected.onlineAnswersHidden ? (
              <p className="mb-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
                {s.voting.secretHelp}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[var(--background)] text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">{s.voting.question}</th>
                    <th className="px-3 py-2 font-medium">{s.voting.manual}</th>
                    <th className="px-3 py-2 font-medium">{s.voting.online}</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictQuestionRows(selected).map((row) => (
                    <tr
                      className="border-b border-[var(--border)] last:border-0"
                      key={row.questionId}
                    >
                      <td className="px-3 py-2">{row.questionText}</td>
                      <td
                        className={[
                          "px-3 py-2",
                          row.differs ? "bg-amber-50 font-semibold" : "",
                        ].join(" ")}
                      >
                        {row.manual?.choiceText ?? "-"}
                      </td>
                      <td
                        className={[
                          "px-3 py-2",
                          row.differs ? "bg-red-50 font-semibold" : "",
                        ].join(" ")}
                      >
                        {selected.onlineAnswersHidden
                          ? s.voting.hidden
                          : (row.online?.choiceText ?? "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResolveConflictForm conflict={selected} onResolved={handleResolved} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
