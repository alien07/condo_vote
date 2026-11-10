"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { deactivateRoom, reactivateRoom } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  escapeSelectorValue,
  mergeParams,
  roomTableParams,
  roomTableStateFromParams,
} from "@/features/admin/components/sections/people/people-table-state";
import type { PeopleCrudPilotProps, RoomTableState } from "@/features/admin/components/sections/people/people-types";
import { RoomForm } from "@/features/admin/components/sections/people/room-form";

type RoomsPanelProps = Pick<
  PeopleCrudPilotProps,
  "activeSection" | "drawer" | "rooms"
>;

export function RoomsPanel({
  activeSection,
  drawer,
  rooms,
}: RoomsPanelProps) {
  const { s } = useStaffText();
  const searchParams = useSearchParams();
  const [roomCriteria, setRoomCriteria] = useState(() =>
    roomTableStateFromParams(searchParams),
  );
  const [roomTableState, setRoomTableState] = useState(() =>
    roomTableStateFromParams(searchParams),
  );
  const closeHref = mergeParams(searchParams, {
    feedback: null,
    id: null,
    message: null,
    mode: null,
    tab: activeSection,
    type: null,
  });
  const buildHref = (updates: Record<string, string | null | undefined>) =>
    mergeParams(searchParams, updates);
  const updateRoomTable = (nextState: RoomTableState) => {
    setRoomTableState(nextState);
    setRoomCriteria(nextState);
    window.history.replaceState(
      null,
      "",
      mergeParams(searchParams, {
        ...roomTableParams(nextState),
        tab: "rooms",
      }),
    );
  };
  const selectedRoom = rooms.find((room) => room.id === drawer?.id);
  const drawerContent = useMemo(() => {
    if (
      (activeSection === "rooms" && drawer?.type !== "room") ||
      (activeSection === "owners" && drawer?.type !== "owner") ||
      (activeSection === "profiles" && drawer?.type !== "profile")
    ) {
      return null;
    }

    if (drawer?.mode === "create" && drawer.type === "room") {
      return {
        content: <RoomForm closeHref={closeHref} mode="create" />,
        summary: [s.people.newRoom],
        title: s.people.addRoom,
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "room" && selectedRoom) {
      return {
        content: <RoomForm closeHref={closeHref} mode="edit" room={selectedRoom} />,
        summary: [
          fill(s.people.roomSummary, { room: selectedRoom.room_number }),
          fill(s.people.statusSummary, {
            status: selectedRoom.active ? s.common.active : s.common.inactive,
          }),
        ],
        title: s.people.editRoom,
      };
    }

    return null;
  }, [
    s,
    activeSection,
    closeHref,
    drawer?.mode,
    drawer?.type,
    selectedRoom,
  ]);
  const filteredRooms = useMemo(() => {
    const roomQuery = roomTableState.room.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesRoom = roomQuery
        ? room.room_number.toLowerCase().includes(roomQuery)
        : true;
      const matchesStatus =
        roomTableState.status === "all"
          ? true
          : roomTableState.status === "active"
            ? Boolean(room.active)
            : !room.active;

      return matchesRoom && matchesStatus;
    });
  }, [roomTableState.room, roomTableState.status, rooms]);
  const sortedRooms = useMemo(() => {
    const direction = roomTableState.dir === "asc" ? 1 : -1;

    return [...filteredRooms].sort((left, right) => {
      const leftValue =
        roomTableState.sort === "status"
          ? left.active
            ? "active"
            : "inactive"
          : left.room_number;
      const rightValue =
        roomTableState.sort === "status"
          ? right.active
            ? "active"
            : "inactive"
          : right.room_number;

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [filteredRooms, roomTableState.dir, roomTableState.sort]);
  const roomTotal = sortedRooms.length;
  const roomTotalPages = Math.max(1, Math.ceil(roomTotal / roomTableState.perPage));
  const roomPage = Math.min(roomTableState.page, roomTotalPages);
  const roomPageStart =
    roomTotal === 0 ? 0 : (roomPage - 1) * roomTableState.perPage + 1;
  const roomPageEnd = Math.min(roomPage * roomTableState.perPage, roomTotal);
  const pagedRooms = sortedRooms.slice(
    (roomPage - 1) * roomTableState.perPage,
    roomPage * roomTableState.perPage,
  );
  const editingRoomId =
    activeSection === "rooms" && drawer?.mode === "edit" && drawer.type === "room"
      ? drawer.id
      : null;
  const focusedRoomId =
    activeSection === "rooms" && !drawer?.mode
      ? searchParams.get("focusRoomId")
      : null;
  const createdRoomNumber =
    activeSection === "rooms" && !drawer?.mode ? searchParams.get("room") : null;
  useEffect(() => {
    if (activeSection !== "rooms") {
      return;
    }

    const selector = editingRoomId
      ? `[data-room-id="${escapeSelectorValue(editingRoomId)}"]`
      : focusedRoomId
        ? `[data-room-id="${escapeSelectorValue(focusedRoomId)}"]`
      : createdRoomNumber
        ? `[data-room-number="${escapeSelectorValue(createdRoomNumber)}"]`
        : null;

    if (!selector) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      ).find((element) => element.getClientRects().length > 0);

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activeSection,
    createdRoomNumber,
    editingRoomId,
    focusedRoomId,
    pagedRooms,
    roomPage,
    roomTableState.perPage,
  ]);

  return (
  <>
    <div className="grid gap-5">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold">{s.people.roomsTitle}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {s.people.roomsIntro}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href={buildHref({ mode: "create", tab: "rooms", type: "room" })}
            >
              {s.people.addRoom}
            </Link>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              href="/admin/people/import"
            >
              {s.people.importMaster}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{s.common.searchCriteria}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.people.roomsFilter}
          </p>
        </div>
        <form
          className="grid gap-3 md:grid-cols-12"
          onSubmit={(event) => {
            event.preventDefault();
            updateRoomTable({ ...roomCriteria, page: 1 });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-5">
            {s.people.room}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value;

                setRoomCriteria((current) => ({ ...current, room: value }));
              }}
              placeholder={s.people.searchRoom}
              value={roomCriteria.room}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.status}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              onChange={(event) => {
                const value = event.currentTarget.value as RoomTableState["status"];

                setRoomCriteria((current) => ({ ...current, status: value }));
              }}
              value={roomCriteria.status}
            >
              <option value="all">{s.common.allStatuses}</option>
              <option value="active">{s.common.active}</option>
              <option value="inactive">{s.common.inactive}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-4">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              {s.common.search}
            </button>
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              onClick={() =>
                updateRoomTable({
                  dir: "asc",
                  page: 1,
                  perPage: 25,
                  room: "",
                  sort: "room",
                  status: "all",
                })
              }
              type="button"
            >
              {s.common.clear}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">{s.people.rooms}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {fill(s.common.showing, { start: roomPageStart, end: roomPageEnd, total: roomTotal })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <span>{s.common.page}</span>
                <select
                  aria-label={s.common.page}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                  disabled={roomTotalPages <= 1}
                  onChange={(event) => {
                    const nextPage = Number(event.currentTarget.value);

                    updateRoomTable({
                      ...roomTableState,
                      page:
                        Number.isInteger(nextPage) && nextPage > 0
                          ? nextPage
                          : 1,
                    });
                  }}
                  value={String(roomPage)}
                >
                  {Array.from(
                    { length: roomTotalPages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {pageNumber}
                    </option>
                  ))}
                </select>
                <span>of {roomTotalPages}</span>
              </label>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <span>{s.common.perPage}</span>
                <select
                  aria-label={s.common.perPage}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                  onChange={(event) => {
                    const nextPerPage = Number(event.currentTarget.value);

                    updateRoomTable({
                      ...roomTableState,
                      page: 1,
                      perPage: Number.isInteger(nextPerPage) ? nextPerPage : 25,
                    });
                  }}
                  value={String(roomTableState.perPage)}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto px-5 pb-2">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">
                  <button
                    className="font-medium"
                    onClick={() =>
                      updateRoomTable({
                        ...roomTableState,
                        dir:
                          roomTableState.sort === "room" &&
                          roomTableState.dir === "asc"
                            ? "desc"
                            : "asc",
                        page: 1,
                        sort: "room",
                      })
                    }
                    type="button"
                  >
                    {s.people.room}
                    {roomTableState.sort === "room"
                      ? roomTableState.dir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                </th>
                <th className="py-2 pr-3 font-medium">{s.people.ownerPercent}</th>
                <th className="py-2 pr-3 font-medium">
                  <button
                    className="font-medium"
                    onClick={() =>
                      updateRoomTable({
                        ...roomTableState,
                        dir:
                          roomTableState.sort === "status" &&
                          roomTableState.dir === "asc"
                            ? "desc"
                            : "asc",
                        page: 1,
                        sort: "status",
                      })
                    }
                    type="button"
                  >
                    {s.common.status}
                    {roomTableState.sort === "status"
                      ? roomTableState.dir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                </th>
                <th className="py-2 font-medium">{s.common.action}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRooms.map((room) => {
                const selected =
                  drawer?.mode === "edit" &&
                  drawer.type === "room" &&
                  drawer.id === room.id;
                const created =
                  !drawer?.mode &&
                  searchParams.get("room") === room.room_number;
                const focused =
                  !drawer?.mode &&
                  searchParams.get("focusRoomId") === room.id;

                return (
                  <tr
                    className={[
                      "border-b border-[var(--border)]",
                      selected || created || focused
                        ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                        : "",
                    ].join(" ")}
                    data-room-id={room.id}
                    data-room-number={room.room_number}
                    key={room.id}
                    tabIndex={-1}
                  >
                    <td className="py-2 pr-3">{room.room_number}</td>
                    <td className="py-2 pr-3">{room.ownership_percent}</td>
                    <td className="py-2 pr-3">
                      {room.active ? s.common.active : s.common.inactive}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          href={buildHref({
                            id: room.id,
                            mode: "edit",
                            tab: "rooms",
                            type: "room",
                          })}
                        >
                          {s.common.edit}
                        </Link>
                        <form
                          action={room.active ? deactivateRoom : reactivateRoom}
                        >
                          <input name="id" type="hidden" value={room.id} />
                          <ConfirmSubmitButton
                            className={
                              room.active
                                ? "rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                                : "rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                            }
                            confirmMessage={
                              room.active
                                ? fill(s.people.confirmDeactivateRoom, { room: room.room_number })
                                : fill(s.people.confirmReactivateRoom, { room: room.room_number })
                            }
                            pendingLabel={
                              room.active ? s.common.deactivating : s.common.reactivating
                            }
                            type="submit"
                          >
                            {room.active ? s.common.deactivate : s.common.reactivate}
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagedRooms.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--muted)]">
            {s.people.noRooms}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <button
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={roomPage <= 1}
            onClick={() =>
              updateRoomTable({
                ...roomTableState,
                page: Math.max(1, roomPage - 1),
              })
            }
            type="button"
          >
            {s.common.previous}
          </button>
          <div className="text-sm text-[var(--muted)]">
            {roomPageStart}-{roomPageEnd} / {roomTotal}
          </div>
          <button
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={roomPage >= roomTotalPages}
            onClick={() =>
              updateRoomTable({
                ...roomTableState,
                page: Math.min(roomTotalPages, roomPage + 1),
              })
            }
            type="button"
          >
            {s.common.next}
          </button>
        </div>
      </section>

    </div>

    {drawerContent ? (
      <AdminCrudDrawer
        closeHref={closeHref}
        lockScroll={drawer?.type !== "room"}
        summary={drawerContent.summary}
        title={drawerContent.title}
      >
        {drawerContent.content}
      </AdminCrudDrawer>
    ) : null}
  </>
);
}
