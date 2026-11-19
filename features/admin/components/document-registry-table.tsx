"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useEffect, useState } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { SearchSelect, type SearchSelectOption } from "@/features/ui/search-select";
import {
  DocumentRows,
  type DocumentRegistryRow,
} from "@/features/admin/components/sections/documents/document-rows";
import { documentTypeLabel } from "@/features/admin/components/sections/documents/document-labels";

export type { DocumentRegistryRow };

type DocumentFilters = {
  dir: "asc" | "desc";
  owner: string;
  page: number;
  perPage: number;
  room: string;
  /** Kept in the URL for links to one document set; no field in the form. */
  set: string;
  sort: "created" | "set" | "type";
  type: string;
};

type DocumentApiResponse = {
  documentPage: number;
  documentPerPage: number;
  documentTotal: number;
  documents: DocumentRegistryRow[];
};

type DocumentRegistryTableProps = {
  documentTypes: readonly string[];
  /** Rooms and owners that some document concerns (filters by id, rule 8). */
  roomOptions: SearchSelectOption[];
  ownerOptions: SearchSelectOption[];
  focusedDocumentId?: string;
  initialFilters: DocumentFilters;
  initialPage: number;
  initialPerPage: number;
  initialRows: DocumentRegistryRow[];
  initialTotal: number;
};

function buildParams(filters: DocumentFilters) {
  const params = new URLSearchParams();

  if (filters.set) {
    params.set("set", filters.set);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.owner) {
    params.set("owner", filters.owner);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return params;
}

function syncUrl(filters: DocumentFilters) {
  const params = buildParams(filters);
  const query = params.toString();

  window.history.replaceState(null, "", query ? `?${query}` : "/admin/documents");
}

export function DocumentRegistryTable({
  documentTypes,
  ownerOptions,
  roomOptions,
  focusedDocumentId,
  initialFilters,
  initialPage,
  initialPerPage,
  initialRows,
  initialTotal,
}: DocumentRegistryTableProps) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const searchText = {
    clear: s.common.searchClear,
    more: s.common.searchMore,
    noResults: s.common.searchNoResults,
  };
  // Drawer links keep the list as it is (filters, page).
  const hrefFor = (mode: "view" | "version", id: string) => {
    const params = buildParams(appliedFilters);

    if (mode === "view") {
      params.set("mode", "view");
      params.set("id", id);
    } else {
      params.set("mode", "create");
      params.set("from", id);
    }

    return `/admin/documents?${params.toString()}`;
  };
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

  useEffect(() => {
    if (!focusedDocumentId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-document-id="${focusedDocumentId}"]`,
        ),
      ).find((element) => element.getClientRects().length > 0);

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedDocumentId, rows]);

  async function load(nextFilters: DocumentFilters) {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams(nextFilters);
      const response = await fetch(`/api/admin/documents?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(s.documents.loadFailed);
      }

      const payload = (await response.json()) as DocumentApiResponse;
      const normalizedFilters = {
        ...nextFilters,
        page: payload.documentPage,
        perPage: payload.documentPerPage,
      };

      setRows(payload.documents);
      setPage(payload.documentPage);
      setPerPage(payload.documentPerPage);
      setTotal(payload.documentTotal);
      setAppliedFilters(normalizedFilters);
      setCriteria(normalizedFilters);
      syncUrl(normalizedFilters);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : s.documents.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  function sortBy(sort: DocumentFilters["sort"]) {
    const dir =
      appliedFilters.sort === sort && appliedFilters.dir === "asc"
        ? "desc"
        : "asc";

    void load({ ...appliedFilters, dir, page: 1, sort });
  }

  return (
    <div>
      <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{s.common.searchCriteria}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.documents.filter}
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
            {s.documents.room}
            <span className="text-[var(--foreground)]">
              <SearchSelect
                defaultValue={criteria.room}
                name="room"
                onChange={(value) => setCriteria((current) => ({ ...current, room: value }))}
                options={roomOptions}
                text={{ ...searchText, placeholder: s.common.allRooms }}
              />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.documents.owner}
            <span className="text-[var(--foreground)]">
              <SearchSelect
                defaultValue={criteria.owner}
                name="owner"
                onChange={(value) => setCriteria((current) => ({ ...current, owner: value }))}
                options={ownerOptions}
                text={{ ...searchText, placeholder: s.common.allOwners }}
              />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.documents.type}
            <select
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  type: value,
                }));
              }}
              value={criteria.type}
            >
              <option value="all">{s.documents.allTypes}</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {documentTypeLabel(s, type)}
                </option>
              ))}
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
                const nextFilters: DocumentFilters = {
                  dir: "desc",
                  owner: "",
                  page: 1,
                  perPage: 25,
                  room: "",
                  set: "",
                  sort: "created",
                  type: "all",
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
                onChange={(event) => {
                  const nextPage = Number(event.currentTarget.value);

                  void load({ ...appliedFilters, page: nextPage });
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
              {s.common.perPage}
              <select
                aria-label={s.common.perPage}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={loading}
                onChange={(event) => {
                  const nextPerPage = Number(event.currentTarget.value);

                  void load({ ...appliedFilters, page: 1, perPage: nextPerPage });
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
        <DocumentRows
          dir={appliedFilters.dir}
          focusedId={focusedDocumentId}
          hrefFor={hrefFor}
          onSort={sortBy}
          rows={rows}
          sort={appliedFilters.sort}
        />
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            {s.documents.noDocuments}
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
