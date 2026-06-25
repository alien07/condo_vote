"use client";

import { useEffect, useMemo, useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  cancelRoomOwnerLinkWithState,
  endRoomOwnerLinkWithState,
  linkRoomOwnerWithState,
  type OwnershipActionState,
  updateRoomOwnerDatesWithState,
} from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type Room = {
  active: boolean | null;
  id: string;
  room_number: string;
};

type Owner = {
  active: boolean | null;
  full_name: string;
  id: string;
};

type RoomOwnerLink = {
  cancelled_at: string | null;
  cancelled_by: string | null;
  ends_at: string | null;
  id: string;
  ownership_role: string;
  owners: {
    full_name: string;
    id?: string;
  } | null;
  rooms: {
    id: string;
    room_number: string;
  } | null;
  starts_at: string | null;
  status: string;
};

type OwnershipManagerProps = {
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  owners: Owner[];
  roomOwners: RoomOwnerLink[];
  rooms: Room[];
};

type OwnershipTableState = {
  dir: "asc" | "desc";
  owner: string;
  page: number;
  perPage: number;
  room: string;
  sort: "owner" | "room" | "status";
  status: "active" | "all" | "cancelled" | "ended" | "scheduled";
};

const initialState: OwnershipActionState = {};

function fieldErrorId(fieldName: string) {
  return `ownership-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: OwnershipActionState) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: OwnershipActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: OwnershipActionState,
  fieldName: string,
  fallback: string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function focusFirstInvalidField(
  form: HTMLFormElement | null,
  state: OwnershipActionState,
) {
  const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

  if (!firstInvalidField) {
    return false;
  }

  const field = form?.elements.namedItem(firstInvalidField);
  const element =
    field instanceof RadioNodeList
      ? field[0]
      : field instanceof HTMLElement
        ? field
        : null;

  element?.focus();
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function ownershipTableStateFromParams(
  params: URLSearchParams,
): OwnershipTableState {
  const sort = params.get("sort");
  const status = params.get("status");

  return {
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    owner: params.get("owner") ?? "",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    room: params.get("room") ?? "",
    sort: sort === "owner" || sort === "status" ? sort : "room",
    status:
      status === "all" ||
      status === "cancelled" ||
      status === "ended" ||
      status === "scheduled"
        ? status
        : "active",
  };
}

function ownershipTableParams(state: OwnershipTableState) {
  return {
    dir: state.dir,
    owner: state.owner || null,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    room: state.room || null,
    sort: state.sort,
    status: state.status === "active" ? null : state.status,
  };
}

function mergeParams(
  currentParams: URLSearchParams,
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(currentParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/admin/ownership?${query}` : "/admin/ownership";
}

function todayLocalDate() {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return offsetDate.toISOString().slice(0, 10);
}

function ownershipDisplayStatus(link: RoomOwnerLink) {
  if (link.status === "cancelled") {
    return "cancelled";
  }

  const today = todayLocalDate();

  if (link.ends_at && link.ends_at < today) {
    return "ended";
  }

  if (link.starts_at && link.starts_at > today) {
    return "scheduled";
  }

  return "active";
}

function statusLabel(status: ReturnType<typeof ownershipDisplayStatus>) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ActionMessage({ state }: { state: OwnershipActionState }) {
  if (state.error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.success}
      </p>
    );
  }

  return null;
}

export function OwnershipManager({
  drawer,
  owners,
  roomOwners,
  rooms,
}: OwnershipManagerProps) {
  const searchParams = useSearchParams();
  const [createState, createAction] = useActionState(
    linkRoomOwnerWithState,
    initialState,
  );
  const createFormRef = useRef<HTMLFormElement>(null);
  const [criteria, setCriteria] = useState(() =>
    ownershipTableStateFromParams(searchParams),
  );
  const [tableState, setTableState] = useState(() =>
    ownershipTableStateFromParams(searchParams),
  );
  const updateTable = (nextState: OwnershipTableState) => {
    setTableState(nextState);
    setCriteria(nextState);
    window.history.replaceState(
      null,
      "",
      mergeParams(searchParams, ownershipTableParams(nextState)),
    );
  };
  const activeRoomOwnerByRoom = useMemo(
    () =>
      new Map(
        roomOwners
          .filter(
            (link) =>
              ownershipDisplayStatus(link) === "active" && link.rooms?.id,
          )
          .map((link) => [link.rooms?.id ?? "", link]),
      ),
    [roomOwners],
  );
  const defaultEndDate = todayLocalDate();
  const listHref = mergeParams(searchParams, {
    id: null,
    mode: null,
    type: null,
  });
  const focusedOwnershipId = searchParams.get("focusOwnershipId");
  const showCreateDrawer =
    drawer?.mode === "create" && drawer.type === "ownership_link";
  const selectedLink = roomOwners.find((link) => link.id === drawer?.id);
  const showEditDatesDrawer =
    drawer?.mode === "edit" &&
    drawer.type === "ownership_dates" &&
    selectedLink &&
    ownershipDisplayStatus(selectedLink) !== "cancelled";
  const showEndLinkDrawer =
    drawer?.mode === "end" &&
    drawer.type === "ownership_link" &&
    selectedLink &&
    ownershipDisplayStatus(selectedLink) === "active";
  const filteredLinks = useMemo(() => {
    const roomQuery = tableState.room.trim().toLowerCase();
    const ownerQuery = tableState.owner.trim().toLowerCase();

    return roomOwners.filter((link) => {
      const roomNumber = link.rooms?.room_number ?? "";
      const ownerName = link.owners?.full_name ?? "";
      const matchesRoom = roomQuery
        ? roomNumber.toLowerCase().includes(roomQuery)
        : true;
      const matchesOwner = ownerQuery
        ? ownerName.toLowerCase().includes(ownerQuery)
        : true;
      const matchesStatus =
        tableState.status === "all"
          ? true
          : ownershipDisplayStatus(link) === tableState.status;

      return matchesRoom && matchesOwner && matchesStatus;
    });
  }, [roomOwners, tableState.owner, tableState.room, tableState.status]);
  const sortedLinks = useMemo(() => {
    const direction = tableState.dir === "asc" ? 1 : -1;

    return [...filteredLinks].sort((left, right) => {
      const leftValue =
        tableState.sort === "owner"
          ? left.owners?.full_name ?? ""
          : tableState.sort === "status"
            ? ownershipDisplayStatus(left)
          : left.rooms?.room_number ?? "";
      const rightValue =
        tableState.sort === "owner"
          ? right.owners?.full_name ?? ""
          : tableState.sort === "status"
            ? ownershipDisplayStatus(right)
          : right.rooms?.room_number ?? "";

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [filteredLinks, tableState.dir, tableState.sort]);
  const total = sortedLinks.length;
  const totalPages = Math.max(1, Math.ceil(total / tableState.perPage));
  const page = Math.min(tableState.page, totalPages);
  const pageStart = total === 0 ? 0 : (page - 1) * tableState.perPage + 1;
  const pageEnd = Math.min(page * tableState.perPage, total);
  const pagedLinks = sortedLinks.slice(
    (page - 1) * tableState.perPage,
    page * tableState.perPage,
  );

  useEffect(() => {
    if (focusFirstInvalidField(createFormRef.current, createState)) {
      return;
    }

    if (!createState.success || !createState.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: createState.recordId,
        id: null,
        message: createState.success,
        mode: null,
        type: null,
      }),
    );
  }, [createState, searchParams]);

  useEffect(() => {
    if (!focusedOwnershipId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-ownership-id="${escapeSelectorValue(focusedOwnershipId)}"]`,
      );

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedOwnershipId, pagedLinks]);

  return (
    <>
      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Search Criteria</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter ownership links by room, owner, and link status.
          </p>
        </div>
        <form
          className="grid gap-3 md:grid-cols-12"
          onSubmit={(event) => {
            event.preventDefault();
            updateTable({ ...criteria, page: 1 });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Room
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({ ...current, room: value }));
              }}
              placeholder="Search room number"
              value={criteria.room}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Owner
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({ ...current, owner: value }));
              }}
              placeholder="Search owner name"
              value={criteria.owner}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Status
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget
                  .value as OwnershipTableState["status"];

                setCriteria((current) => ({ ...current, status: value }));
              }}
              value={criteria.status}
            >
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              Search
            </button>
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              onClick={() =>
                updateTable({
                  dir: "asc",
                  owner: "",
                  page: 1,
                  perPage: 25,
                  room: "",
                  sort: "room",
                  status: "active",
                })
              }
              type="button"
            >
              Clear
            </button>
          </div>
        </form>
      </section>
      <div className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
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
                aria-label="Page"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                disabled={totalPages <= 1}
                onChange={(event) => {
                  const nextPage = Number(event.currentTarget.value);

                  updateTable({
                    ...tableState,
                    page:
                      Number.isInteger(nextPage) && nextPage > 0 ? nextPage : 1,
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
                aria-label="Per page"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const nextPerPage = Number(event.currentTarget.value);

                  updateTable({
                    ...tableState,
                    page: 1,
                    perPage: Number.isInteger(nextPerPage) ? nextPerPage : 25,
                  });
                }}
                value={String(tableState.perPage)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <button
                  className="font-medium"
                  onClick={() =>
                    updateTable({
                      ...tableState,
                      dir:
                        tableState.sort === "room" && tableState.dir === "asc"
                          ? "desc"
                          : "asc",
                      page: 1,
                      sort: "room",
                    })
                  }
                  type="button"
                >
                  Room
                  {tableState.sort === "room"
                    ? tableState.dir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">
                <button
                  className="font-medium"
                  onClick={() =>
                    updateTable({
                      ...tableState,
                      dir:
                        tableState.sort === "owner" && tableState.dir === "asc"
                          ? "desc"
                          : "asc",
                      page: 1,
                      sort: "owner",
                    })
                  }
                  type="button"
                >
                  Owner
                  {tableState.sort === "owner"
                    ? tableState.dir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Dates</th>
              <th className="py-2 pr-3 font-medium">
                <button
                  className="font-medium"
                  onClick={() =>
                    updateTable({
                      ...tableState,
                      dir:
                        tableState.sort === "status" && tableState.dir === "asc"
                          ? "desc"
                          : "asc",
                      page: 1,
                      sort: "status",
                    })
                  }
                  type="button"
                >
                  Status
                  {tableState.sort === "status"
                    ? tableState.dir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
              </th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedLinks.map((link) => (
              <OwnershipRow
                actionHref={(updates) => mergeParams(searchParams, updates)}
                focused={focusedOwnershipId === link.id}
                key={link.id}
                link={link}
                selected={drawer?.id === link.id}
              />
            ))}
          </tbody>
        </table>
      </div>
      {pagedLinks.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No room ownership links match the selected criteria.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={page <= 1}
          onClick={() =>
            updateTable({
              ...tableState,
              page: Math.max(1, page - 1),
            })
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
          disabled={page >= totalPages}
          onClick={() =>
            updateTable({
              ...tableState,
              page: Math.min(totalPages, page + 1),
            })
          }
          type="button"
        >
          Next
        </button>
      </div>
      {showCreateDrawer ? (
        <AdminCrudDrawer
          closeHref={listHref}
          summary={["New room-owner link"]}
          title="Create ownership link"
        >
          <form
            action={createAction}
            className="grid gap-3"
            noValidate
            ref={createFormRef}
          >
            <RequiredNote />
            <ActionMessage state={createState} />
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Room</FieldLabel>
              <select
                {...fieldProps("room_id", createState)}
                autoFocus
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "room_id")}
                name="room_id"
                required
              >
                <option value="">Select room</option>
                {rooms
                  .filter((room) => room.active)
                  .map((room) => {
                    const activeLink = activeRoomOwnerByRoom.get(room.id);

                    return (
                      <option key={room.id} value={room.id}>
                        {room.room_number}
                        {activeLink
                          ? ` (current: ${activeLink.owners?.full_name ?? "owner"})`
                          : ""}
                      </option>
                    );
                  })}
              </select>
              <FieldError fieldName="room_id" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Owner</FieldLabel>
              <select
                {...fieldProps("owner_id", createState)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "owner_id")}
                name="owner_id"
                required
              >
                <option value="">Select owner</option>
                {owners
                  .filter((owner) => owner.active)
                  .map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name}
                    </option>
                  ))}
              </select>
              <FieldError fieldName="owner_id" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Ownership role</FieldLabel>
              <select
                {...fieldProps("ownership_role", createState)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "ownership_role", "owner")}
                name="ownership_role"
                required
              >
                <option value="owner">Owner</option>
              </select>
              <FieldError fieldName="ownership_role" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Effective from
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "starts_at")}
                name="starts_at"
                type="date"
              />
              <span className="text-xs font-normal text-[var(--muted)]">
                Optional. Leave blank when the exact start date is not tracked.
              </span>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Effective until
              <input
                {...fieldProps("ends_at", createState)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "ends_at")}
                name="ends_at"
                type="date"
              />
              <span className="text-xs font-normal text-[var(--muted)]">
                  Leave blank when the ownership link has no planned end date.
              </span>
              <FieldError fieldName="ends_at" state={createState} />
            </label>
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <PendingSubmitButton
                className="self-end rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                debugName="admin.ownership.create"
                pendingLabel="Adding..."
                type="submit"
              >
                Create ownership link
              </PendingSubmitButton>
              <FormResetButton label="Clear form" />
              <a
                className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                href={listHref}
              >
                Cancel
              </a>
            </div>
          </form>
        </AdminCrudDrawer>
      ) : null}
      {showEditDatesDrawer && selectedLink ? (
        <EditDatesDrawer closeHref={listHref} link={selectedLink} />
      ) : null}
      {showEndLinkDrawer && selectedLink ? (
        <EndLinkDrawer
          closeHref={listHref}
          defaultEndDate={defaultEndDate}
          link={selectedLink}
        />
      ) : null}
    </>
  );
}

function EditDatesDrawer({
  closeHref,
  link,
}: {
  closeHref: string;
  link: RoomOwnerLink;
}) {
  const [state, action] = useActionState(
    updateRoomOwnerDatesWithState,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: state.recordId,
        id: null,
        message: state.success,
        mode: null,
        type: null,
      }),
    );
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        `Room: ${link.rooms?.room_number ?? "-"}`,
        `Owner: ${link.owners?.full_name ?? "-"}`,
      ]}
      title="Edit ownership dates"
    >
      <form action={action} className="grid gap-3" noValidate ref={formRef}>
        <ActionMessage state={state} />
        <input name="id" type="hidden" value={link.id} />
        <label className="grid gap-1 text-sm font-medium">
          Effective from
          <input
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "starts_at", link.starts_at)}
            name="starts_at"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Effective until
          <input
            {...fieldProps("ends_at", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "ends_at", link.ends_at)}
            name="ends_at"
            type="date"
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            Leave blank when the ownership link has no planned end date.
          </span>
          <FieldError fieldName="ends_at" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            debugName="admin.ownership.edit_dates"
            pendingLabel="Saving..."
            type="submit"
          >
            Save dates
          </PendingSubmitButton>
          <FormResetButton label="Reset changes" />
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            Cancel
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}

function EndLinkDrawer({
  closeHref,
  defaultEndDate,
  link,
}: {
  closeHref: string;
  defaultEndDate: string;
  link: RoomOwnerLink;
}) {
  const [state, action] = useActionState(endRoomOwnerLinkWithState, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: state.recordId,
        id: null,
        message: state.success,
        mode: null,
        type: null,
      }),
    );
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        `Room: ${link.rooms?.room_number ?? "-"}`,
        `Owner: ${link.owners?.full_name ?? "-"}`,
        `Dates: ${link.starts_at ?? "Not set"} - ${link.ends_at ?? "No end date"}`,
      ]}
      title="End ownership link"
    >
      <form action={action} className="grid gap-3" noValidate ref={formRef}>
        <ActionMessage state={state} />
        <input name="id" type="hidden" value={link.id} />
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This owner will no longer be active for this room after the selected
          end date.
        </p>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>End date</FieldLabel>
          <input
            {...fieldProps("ends_at", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "ends_at", defaultEndDate)}
            name="ends_at"
            required
            type="date"
          />
          <FieldError fieldName="ends_at" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <ConfirmSubmitButton
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white"
            confirmMessage={`End ownership link for room ${link.rooms?.room_number ?? "-"} and owner ${link.owners?.full_name ?? "-"}? This owner will no longer be active for that room after the selected end date.`}
            debugName="admin.ownership.end"
            pendingLabel="Saving..."
            type="submit"
          >
            End Link
          </ConfirmSubmitButton>
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            Cancel
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}

function OwnershipRow({
  actionHref,
  focused,
  link,
  selected,
}: {
  actionHref: (updates: Record<string, string | null | undefined>) => string;
  focused: boolean;
  link: RoomOwnerLink;
  selected: boolean;
}) {
  const [cancelState, cancelAction] = useActionState(
    cancelRoomOwnerLinkWithState,
    initialState,
  );
  const searchParams = useSearchParams();
  const status = ownershipDisplayStatus(link);

  useEffect(() => {
    if (!cancelState.success || !cancelState.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: cancelState.recordId,
        id: null,
        message: cancelState.success,
        mode: null,
        type: null,
      }),
    );
  }, [cancelState, searchParams]);

  return (
    <>
      <tr
        className={[
          "border-b border-[var(--border)]",
          selected || focused
            ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
            : "",
        ].join(" ")}
        data-ownership-id={link.id}
        tabIndex={-1}
      >
        <td className="py-2 pr-3">{link.rooms?.room_number ?? "-"}</td>
        <td className="py-2 pr-3">{link.owners?.full_name ?? "-"}</td>
        <td className="py-2 pr-3">{link.ownership_role}</td>
        <td className="py-2 pr-3">
          {link.starts_at ?? "Not set"} - {link.ends_at ?? "No end date"}
        </td>
        <td className="py-2 pr-3">
          <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-medium">
            {statusLabel(status)}
          </span>
        </td>
        <td className="py-2">
          <div className="flex flex-wrap gap-3">
            {status === "active" || status === "scheduled" ? (
              <a
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                href={actionHref({
                  id: link.id,
                  mode: "edit",
                  type: "ownership_dates",
                })}
              >
                Edit dates
              </a>
            ) : null}
            {status === "active" ? (
              <a
                className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                href={actionHref({
                  id: link.id,
                  mode: "end",
                  type: "ownership_link",
                })}
              >
                End Link
              </a>
            ) : null}
            {status === "scheduled" ? (
              <form action={cancelAction}>
                <input name="id" type="hidden" value={link.id} />
                <ConfirmSubmitButton
                  className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                  confirmMessage={`Cancel scheduled ownership link for room ${link.rooms?.room_number ?? "-"} and owner ${link.owners?.full_name ?? "-"}? This link will not become active and will not be used for voting eligibility.`}
                  debugName="admin.ownership.cancel"
                  pendingLabel="Cancelling..."
                  type="submit"
                >
                  Cancel scheduled link
                </ConfirmSubmitButton>
              </form>
            ) : null}
            {status === "ended" || status === "cancelled" ? (
              <span className="text-sm text-[var(--muted)]">Read only</span>
            ) : null}
          </div>
        </td>
      </tr>
      {cancelState.error || cancelState.success ? (
        <tr className="border-b border-[var(--border)]">
          <td className="py-2" colSpan={6}>
            <ActionMessage state={cancelState} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
