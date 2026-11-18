"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useEffect, useMemo, useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { linkRoomOwnerWithState } from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { SearchSelect, type SearchSelectOption } from "@/features/ui/search-select";
import {
  type OwnershipManagerProps,
  type OwnershipTableState,
  initialState,
  FieldError,
  stateValue,
  focusFirstInvalidField,
  escapeSelectorValue,
  ownershipTableStateFromParams,
  ownershipTableParams,
  mergeParams,
  todayLocalDate,
  ownershipDisplayStatus,
  ActionMessage,
  fieldProps,
} from "@/features/admin/components/ownership/ownership-helpers";
import {
  EditDatesDrawer,
  EndLinkDrawer,
} from "@/features/admin/components/ownership/ownership-drawers";
import { OwnershipRow } from "@/features/admin/components/ownership/ownership-row";

export function OwnershipManager({
  drawer,
  owners,
  roomOwners,
  rooms,
}: OwnershipManagerProps) {
  const { s } = useStaffText();
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
  // Type-to-search lists for the new-link form (2026-11-18): a long condo
  // made the plain dropdowns hard to use.
  const roomOptions = useMemo<SearchSelectOption[]>(
    () =>
      rooms
        .filter((room) => room.active)
        .map((room) => {
          const owner = activeRoomOwnerByRoom.get(room.id)?.owners?.full_name;
          const place = [
            room.building,
            room.floor != null && room.floor !== "" ? fill(s.ownership.floorHint, { floor: room.floor }) : null,
          ].filter(Boolean);

          return {
            value: room.id,
            label: room.room_number,
            hint: [...place, owner ? fill(s.ownership.ownerHint, { name: owner }) : s.ownership.noOwnerHint].join(" · "),
            keywords: owner ?? "",
          };
        }),
    [rooms, activeRoomOwnerByRoom, s],
  );
  const ownerOptions = useMemo<SearchSelectOption[]>(() => {
    const roomsByOwner = new Map<string, string[]>();

    for (const link of activeRoomOwnerByRoom.values()) {
      const ownerId = link.owners?.id;

      if (ownerId && link.rooms?.room_number) {
        roomsByOwner.set(ownerId, [...(roomsByOwner.get(ownerId) ?? []), link.rooms.room_number]);
      }
    }

    return owners
      .filter((owner) => owner.active)
      .map((owner) => {
        const ownedRooms = roomsByOwner.get(owner.id) ?? [];

        return {
          value: owner.id,
          label: owner.full_name,
          hint: [
            owner.email,
            owner.phone,
            ownedRooms.length > 0 ? fill(s.ownership.roomsHint, { count: ownedRooms.length }) : null,
          ]
            .filter(Boolean)
            .join(" · "),
          keywords: ownedRooms.join(" "),
        };
      });
  }, [owners, activeRoomOwnerByRoom, s]);
  const searchText = {
    clear: s.common.searchClear,
    more: s.common.searchMore,
    noResults: s.common.searchNoResults,
  };
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
          <h2 className="text-sm font-semibold">{s.common.searchCriteria}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.ownership.filter}
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
            {s.ownership.room}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({ ...current, room: value }));
              }}
              placeholder={s.ownership.searchRoom}
              value={criteria.room}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.ownership.owner}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setCriteria((current) => ({ ...current, owner: value }));
              }}
              placeholder={s.ownership.searchOwner}
              value={criteria.owner}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.status}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget
                  .value as OwnershipTableState["status"];

                setCriteria((current) => ({ ...current, status: value }));
              }}
              value={criteria.status}
            >
              <option value="active">{s.ownership.status.active}</option>
              <option value="scheduled">{s.ownership.status.scheduled}</option>
              <option value="ended">{s.ownership.status.ended}</option>
              <option value="cancelled">{s.ownership.status.cancelled}</option>
              <option value="all">{s.common.allStatuses}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              {s.common.search}
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
              {s.common.clear}
            </button>
          </div>
        </form>
      </section>
      <div className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
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
              <span>{s.common.perPage}</span>
              <select
                aria-label={s.common.perPage}
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
                  {s.ownership.room}
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
                  {s.ownership.owner}
                  {tableState.sort === "owner"
                    ? tableState.dir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
              </th>
              <th className="py-2 pr-3 font-medium">{s.ownership.role}</th>
              <th className="py-2 pr-3 font-medium">{s.ownership.dates}</th>
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
                  {s.common.status}
                  {tableState.sort === "status"
                    ? tableState.dir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
              </th>
              <th className="py-2 font-medium">{s.common.actions}</th>
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
          {s.ownership.noLinks}
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
          {s.common.previous}
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
          {s.common.next}
        </button>
      </div>
      {showCreateDrawer ? (
        <AdminCrudDrawer
          closeHref={listHref}
          summary={[s.ownership.newLink]}
          title={s.ownership.create}
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
              <FieldLabel required>{s.ownership.room}</FieldLabel>
              <SearchSelect
                {...fieldProps("room_id", createState)}
                autoFocus
                defaultValue={stateValue(createState, "room_id")}
                name="room_id"
                options={roomOptions}
                text={{ ...searchText, placeholder: s.ownership.searchRoomPick }}
              />
              <FieldError fieldName="room_id" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>{s.ownership.owner}</FieldLabel>
              <SearchSelect
                {...fieldProps("owner_id", createState)}
                defaultValue={stateValue(createState, "owner_id")}
                name="owner_id"
                options={ownerOptions}
                text={{ ...searchText, placeholder: s.ownership.searchOwnerPick }}
              />
              <FieldError fieldName="owner_id" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>{s.ownership.ownershipRole}</FieldLabel>
              <select
                {...fieldProps("ownership_role", createState)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "ownership_role", "owner")}
                name="ownership_role"
                required
              >
                <option value="owner">{s.ownership.owner}</option>
              </select>
              <FieldError fieldName="ownership_role" state={createState} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {s.ownership.from}
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "starts_at")}
                name="starts_at"
                type="date"
              />
              <span className="text-xs font-normal text-[var(--muted)]">
                {s.ownership.fromHelp}
              </span>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {s.ownership.until}
              <input
                {...fieldProps("ends_at", createState)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(createState, "ends_at")}
                name="ends_at"
                type="date"
              />
              <span className="text-xs font-normal text-[var(--muted)]">
                  {s.ownership.untilHelp}
              </span>
              <FieldError fieldName="ends_at" state={createState} />
            </label>
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <PendingSubmitButton
                className="self-end rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                debugName="admin.ownership.create"
                pendingLabel={s.ownership.adding}
                type="submit"
              >
                {s.ownership.create}
              </PendingSubmitButton>
              <FormResetButton label="Clear form" />
              <a
                className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                href={listHref}
              >
                {s.common.cancel}
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
