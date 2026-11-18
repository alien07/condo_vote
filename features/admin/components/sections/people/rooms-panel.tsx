"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { deactivateRoom, reactivateRoom } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  AdminListCard,
  AdminListEmpty,
  AdminListFooterPager,
  AdminListPager,
  AdminListToolbar,
  SortHeader,
  listActionsClass,
  listFieldClass,
  listInputClass,
  listNumericClass,
  listQuietButtonClass,
  listQuietDangerButtonClass,
  listRowButtonClass,
  listRowClass,
  listTableClass,
  listTdClass,
  listThClass,
  listTheadClass,
} from "@/features/admin/components/list/admin-list";
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
  const [searchRuns, setSearchRuns] = useState(0);
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

  const sortBy = (sort: RoomTableState["sort"]) =>
    updateRoomTable({
      ...roomTableState,
      dir: roomTableState.sort === sort && roomTableState.dir === "asc" ? "desc" : "asc",
      page: 1,
      sort,
    });
  const clearRoomTable = () =>
    updateRoomTable({
      dir: "asc",
      page: 1,
      perPage: 25,
      room: "",
      sort: "room",
      status: "all",
    });
  // Search feedback: the count, the filters in use, and a fade on every
  // search (even a repeated one, hence searchRuns).
  const roomFilters = [
    ...(roomTableState.room.trim()
      ? [
          {
            key: "room",
            label: `${s.people.room}: ${roomTableState.room.trim()}`,
            onRemove: () => updateRoomTable({ ...roomTableState, page: 1, room: "" }),
          },
        ]
      : []),
    ...(roomTableState.status !== "all"
      ? [
          {
            key: "status",
            label: `${s.common.status}: ${
              roomTableState.status === "active" ? s.common.active : s.common.inactive
            }`,
            onRemove: () => updateRoomTable({ ...roomTableState, page: 1, status: "all" }),
          },
        ]
      : []),
  ];
  const roomShowing = fill(s.common.showing, {
    start: roomPageStart,
    end: roomPageEnd,
    total: roomTotal,
  });
  const roomFound = fill(s.common.foundOf, { count: roomTotal, total: rooms.length });
  const roomMeta = !roomFilters.length
    ? roomShowing
    : roomTotal
      ? `${roomFound} · ${roomShowing}`
      : roomFound;

  return (
  <>
    <AdminListCard
      actions={
        <>
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
        </>
      }
      description={s.people.roomsIntro}
      footer={
        <AdminListFooterPager
          end={roomPageEnd}
          onPage={(page) => updateRoomTable({ ...roomTableState, page })}
          page={roomPage}
          start={roomPageStart}
          total={roomTotal}
          totalPages={roomTotalPages}
        />
      }
      filters={roomFilters}
      icon={<Building2 aria-hidden="true" size={20} />}
      meta={roomMeta}
      pager={
        <AdminListPager
          onPage={(page) => updateRoomTable({ ...roomTableState, page })}
          onPerPage={(perPage) => updateRoomTable({ ...roomTableState, page: 1, perPage })}
          page={roomPage}
          perPage={roomTableState.perPage}
          totalPages={roomTotalPages}
        />
      }
      resultKey={`${JSON.stringify(roomTableState)}:${searchRuns}`}
      title={s.people.rooms}
      toolbar={
        <AdminListToolbar
          onClear={clearRoomTable}
          onSubmit={() => {
            setSearchRuns((runs) => runs + 1);
            updateRoomTable({ ...roomCriteria, page: 1 });
          }}
        >
          <label className={`${listFieldClass} w-full sm:w-64`}>
            {s.people.room}
            <input
              className={listInputClass}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setRoomCriteria((current) => ({ ...current, room: value }));
              }}
              placeholder={s.people.searchRoom}
              value={roomCriteria.room}
            />
          </label>
          <label className={`${listFieldClass} w-full sm:w-44`}>
            {s.common.status}
            <select
              className={listInputClass}
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
        </AdminListToolbar>
      }
    >
      <table className={listTableClass}>
        <thead className={listTheadClass}>
          <tr>
            <SortHeader
              active={roomTableState.sort === "room"}
              dir={roomTableState.dir}
              label={s.people.room}
              onSort={() => sortBy("room")}
            />
            <th className={`${listThClass} ${listNumericClass}`} scope="col">
              {s.people.ownerPercent}
            </th>
            <SortHeader
              active={roomTableState.sort === "status"}
              dir={roomTableState.dir}
              label={s.common.status}
              onSort={() => sortBy("status")}
            />
            <th className={listThClass} scope="col">{s.common.action}</th>
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
                  listRowClass,
                  selected || created || focused
                    ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                    : "",
                ].join(" ")}
                data-room-id={room.id}
                data-room-number={room.room_number}
                key={room.id}
                tabIndex={-1}
              >
                <td className={`${listTdClass} font-medium`}>{room.room_number}</td>
                <td className={`${listTdClass} ${listNumericClass}`}>{room.ownership_percent}</td>
                <td className={listTdClass}>
                  {room.active ? s.common.active : s.common.inactive}
                </td>
                <td className={listTdClass}>
                  <div className={listActionsClass}>
                    <Link
                      className={listRowButtonClass}
                      href={buildHref({
                        id: room.id,
                        mode: "edit",
                        tab: "rooms",
                        type: "room",
                      })}
                    >
                      {s.common.edit}
                    </Link>
                    <form action={room.active ? deactivateRoom : reactivateRoom}>
                      <input name="id" type="hidden" value={room.id} />
                      <ConfirmSubmitButton
                        className={room.active ? listQuietDangerButtonClass : listQuietButtonClass}
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
      {pagedRooms.length === 0 ? (
        <AdminListEmpty
          message={s.people.noRooms}
          onClearFilters={roomFilters.length ? clearRoomTable : undefined}
        />
      ) : null}
    </AdminListCard>

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
