"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  resolveVoteSourceConflictWithState,
  type VoteSourceConflictActionState,
} from "@/features/admin/actions";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type ConflictAnswer = {
  choiceId: string;
  choiceText: string;
  questionId: string;
  questionText: string;
};

export type VoteConflictRow = {
  key: string;
  manualAnswers: ConflictAnswer[];
  manualBallotId: string;
  manualIdentityStatus: string;
  manualImportedAt: string;
  manualSourceLabel: string | null;
  manualVoterIdentityText: string | null;
  manualVoterProfileId: string | null;
  meetingId: string;
  meetingTitle: string;
  onlineAnswers: ConflictAnswer[];
  onlineBallotId: string;
  onlineSubmittedAt: string;
  resolution: {
    chosen_source: string;
    conflict_remark: string | null;
    resolved_at: string;
  } | null;
  roomId: string;
  roomNumber: string;
  status: "resolved" | "unresolved";
};

type ConflictFilters = {
  dir: "asc" | "desc";
  meeting: string;
  page: number;
  perPage: number;
  room: string;
  sort: "meeting" | "resolved_at" | "room" | "status";
  status: string;
};

type ConflictApiResponse = {
  conflictPage: number;
  conflictPerPage: number;
  conflictTotal: number;
  conflicts: VoteConflictRow[];
};

type VoteConflictsTableProps = {
  initialFilters: ConflictFilters;
  initialPage: number;
  initialPerPage: number;
  initialRows: VoteConflictRow[];
  initialTotal: number;
};

function buildParams(filters: ConflictFilters) {
  const params = new URLSearchParams();

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return params;
}

function syncUrl(filters: ConflictFilters) {
  const params = buildParams(filters);
  const query = params.toString();

  window.history.replaceState(
    null,
    "",
    query ? `/admin/voting/conflicts?${query}` : "/admin/voting/conflicts",
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
}

function answerByQuestion(answers: ConflictAnswer[]) {
  return new Map(answers.map((answer) => [answer.questionId, answer]));
}

function conflictQuestionRows(conflict: VoteConflictRow) {
  const onlineByQuestion = answerByQuestion(conflict.onlineAnswers);
  const manualByQuestion = answerByQuestion(conflict.manualAnswers);
  const questionIds = [
    ...new Set([
      ...conflict.manualAnswers.map((answer) => answer.questionId),
      ...conflict.onlineAnswers.map((answer) => answer.questionId),
    ]),
  ];

  return questionIds.map((questionId) => {
    const manual = manualByQuestion.get(questionId);
    const online = onlineByQuestion.get(questionId);

    return {
      differs: manual?.choiceId !== online?.choiceId,
      manual,
      online,
      questionId,
      questionText: manual?.questionText ?? online?.questionText ?? "-",
    };
  });
}

const emptyConflictState: VoteSourceConflictActionState = {};

function ResolveConflictForm({
  conflict,
  onResolved,
}: {
  conflict: VoteConflictRow;
  onResolved: (recordKey: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    resolveVoteSourceConflictWithState,
    emptyConflictState,
  );

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const field = formRef.current?.elements.namedItem(firstInvalidField);
      const element =
        field instanceof RadioNodeList
          ? field[0]
          : field instanceof HTMLElement
            ? field
            : null;

      element?.focus();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (state.success && state.recordKey) {
      onResolved(state.recordKey);
    }
  }, [onResolved, state]);

  return (
    <form action={formAction} className="mt-5 grid gap-3" noValidate ref={formRef}>
      {state.error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}
      <input name="meeting_id" type="hidden" value={conflict.meetingId} />
      <input name="room_id" type="hidden" value={conflict.roomId} />
      <input
        name="online_ballot_id"
        type="hidden"
        value={conflict.onlineBallotId}
      />
      <input
        name="manual_ballot_id"
        type="hidden"
        value={conflict.manualBallotId}
      />
      <label className="grid gap-1 text-sm font-medium">
        Chosen source
        <select
          aria-invalid={state.fieldErrors?.chosen_source ? "true" : undefined}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={
            state.values?.chosen_source ??
            conflict.resolution?.chosen_source ??
            "manual"
          }
          name="chosen_source"
        >
          <option value="manual">Manual</option>
          <option value="online">Online</option>
        </select>
        {state.fieldErrors?.chosen_source ? (
          <p className="text-xs font-medium text-red-700">
            {state.fieldErrors.chosen_source}
          </p>
        ) : null}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Conflict remark
        <textarea
          className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={
            state.values?.conflict_remark ??
            conflict.resolution?.conflict_remark ??
            ""
          }
          name="conflict_remark"
          placeholder="Explain why this source is selected."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <PendingSubmitButton
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel="Saving..."
          type="submit"
        >
          Resolve source
        </PendingSubmitButton>
        <FormResetButton label="Reset changes" />
      </div>
    </form>
  );
}

export function VoteConflictsTable({
  initialFilters,
  initialPage,
  initialPerPage,
  initialRows,
  initialTotal,
}: VoteConflictsTableProps) {
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
        throw new Error("Could not load conflicts.");
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
          : "Could not load conflicts.",
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
    setMessage("Conflict resolved.");
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
          <h2 className="text-sm font-semibold">Search Criteria</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter conflicts by meeting, room, and resolution status.
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
            Meeting
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  meeting: value,
                }));
              }}
              placeholder="Search meeting"
              value={criteria.meeting}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Room
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({
                  ...current,
                  room: value,
                }));
              }}
              placeholder="Search room"
              value={criteria.room}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Status
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
              <option value="all">All statuses</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
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
              <span>of {totalPages}</span>
            </label>
            <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              Per page
              <select
                aria-label="Per page"
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
            {error}
          </p>
        ) : null}
        {message ? (
          <div className="border-b border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {message}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                {[
                  ["meeting", "Meeting"],
                  ["room", "Room"],
                  ["status", "Status"],
                  ["resolved_at", "Resolved at"],
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
                <th className="px-4 py-3 font-medium">Action</th>
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
                    <td className="px-4 py-3">{conflict.status}</td>
                    <td className="px-4 py-3">
                      {formatDateTime(conflict.resolution?.resolved_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                        onClick={() => setSelected(conflict)}
                        type="button"
                      >
                        Review / Resolve
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
            No manual/online conflicts match the selected criteria.
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

      {selected ? (
        <div
          aria-label="Review vote source conflict"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="dialog"
        >
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Review conflict</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selected.meetingTitle} / room {selected.roomNumber}
                </p>
              </div>
              <button
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                onClick={() => setSelected(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Answers are read-only. Choose one source for the whole ballot. Manual
              is the default because it represents the signed vote sheet collected
              at the meeting venue.
            </p>
            <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <p className="font-medium">Manual ballot identity</p>
              <p className="mt-1 text-[var(--muted)]">
                {selected.manualIdentityStatus} /{" "}
                {selected.manualVoterIdentityText ??
                  selected.manualVoterProfileId ??
                  "identity not captured"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[var(--background)] text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">Question</th>
                    <th className="px-3 py-2 font-medium">Manual</th>
                    <th className="px-3 py-2 font-medium">Online</th>
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
                        {row.online?.choiceText ?? "-"}
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
