"use client";

import { useEffect, useState } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

export type DocumentRegistryRow = {
  checksum_sha256: string | null;
  created_at: string;
  document_set_key: string;
  document_type: string;
  document_version: number;
  file_size_bytes: number | null;
  id: string;
  mime_type: string | null;
  original_filename: string | null;
  owner_id: string;
  owner_type: string;
  storage_path: string;
  storage_provider: string;
};

type DocumentFilters = {
  dir: "asc" | "desc";
  page: number;
  perPage: number;
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
  documentTypes: string[];
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

function formatDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

export function DocumentRegistryTable({
  documentTypes,
  focusedDocumentId,
  initialFilters,
  initialPage,
  initialPerPage,
  initialRows,
  initialTotal,
}: DocumentRegistryTableProps) {
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
        throw new Error("Could not load documents.");
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
          : "Could not load documents.",
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
          <h2 className="text-sm font-semibold">Search Criteria</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter document references by document set and document type.
          </p>
        </div>
        <form
          className="grid gap-3 md:grid-cols-12"
          onSubmit={(event) => {
            event.preventDefault();
            void load({ ...criteria, page: 1, perPage });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-5">
            Set
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  set: value,
                }));
              }}
              placeholder="Search document set"
              value={criteria.set}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            Type
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  type: value,
                }));
              }}
              value={criteria.type}
            >
              <option value="all">All types</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
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
                const nextFilters: DocumentFilters = {
                  dir: "desc",
                  page: 1,
                  perPage: 25,
                  set: "",
                  sort: "created",
                  type: "all",
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
            <h2 className="text-sm font-semibold">Results</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              Page
              <select
                aria-label="Page"
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
              <span>of {totalPages}</span>
            </label>
            <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              Per page
              <select
                aria-label="Per page"
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
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                {[
                  ["set", "Set / version"],
                  ["type", "Type"],
                  ["created", "Created"],
                ].map(([sort, label]) => (
                  <th className="px-4 py-3 font-medium" key={sort}>
                    <button
                      className="font-medium"
                      onClick={() => sortBy(sort as DocumentFilters["sort"])}
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
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Path or link</th>
                <th className="px-4 py-3 font-medium">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document, index) => {
                const created = formatDateTime(document.created_at);

                return (
                  <tr
                    className={[
                      "border-b border-[var(--border)] last:border-0",
                      document.id === focusedDocumentId
                        ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                        : index % 2 === 0
                          ? "bg-[var(--surface)]"
                          : "bg-[var(--background)]",
                    ].join(" ")}
                    data-document-id={document.id}
                    key={document.id}
                    tabIndex={-1}
                  >
                    <td className="px-4 py-3">
                      {document.document_set_key} / v{document.document_version}
                    </td>
                    <td className="px-4 py-3">{document.document_type}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <div>{created.date}</div>
                      <div className="text-[var(--muted)]">{created.time}</div>
                    </td>
                    <td className="px-4 py-3">{document.storage_provider}</td>
                    <td className="max-w-xs truncate px-4 py-3">
                      {document.storage_path}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      {document.checksum_sha256 ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            No private document references match the selected criteria.
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
