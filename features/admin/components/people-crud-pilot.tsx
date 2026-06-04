"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Building2, LoaderCircle, UserRound } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  createOwnerWithState,
  createRoomWithState,
  deactivateOwner,
  deactivateRoom,
  reactivateOwner,
  reactivateRoom,
  revokeAppRole,
  updateOwnerWithState,
  updateProfileAccessWithState,
  updateRoomWithState,
} from "@/features/admin/actions";
import type { PeopleActionState } from "@/features/admin/action-modules/people";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";

type Room = {
  active: boolean | null;
  area_size: number | string | null;
  building: string | null;
  floor: string | null;
  id: string;
  ownership_percent: number | string | null;
  room_number: string;
};

type Owner = {
  active: boolean | null;
  email: string | null;
  full_name: string;
  id: string;
  line_id: string | null;
  phone: string | null;
};

type Profile = {
  approval_status: string;
  default_status: string;
  email: string;
  full_name: string;
  id: string;
};

type AppRole = {
  id: string;
  profile_id: string;
  role: string;
};

type PeopleCrudPilotProps = {
  activeSection: "owners" | "profiles" | "rooms";
  appRolesByProfile: Map<string, AppRole[]>;
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  owners: Owner[];
  profiles: Profile[];
  rooms: Room[];
};

type RoomTableState = {
  dir: "asc" | "desc";
  page: number;
  perPage: number;
  room: string;
  sort: "room" | "status";
  status: "active" | "all" | "inactive";
};

const emptyState: PeopleActionState = {};

function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function roomTableStateFromParams(params: URLSearchParams): RoomTableState {
  const sort = params.get("sort");
  const status = params.get("status");

  return {
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    room: params.get("room") ?? "",
    sort: sort === "status" ? "status" : "room",
    status:
      status === "active" || status === "inactive" || status === "all"
        ? status
        : "all",
  };
}

function roomTableParams(state: RoomTableState) {
  return {
    dir: state.dir,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    room: state.room || null,
    sort: state.sort,
    status: state.status === "all" ? null : state.status,
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
  return query ? `?${query}` : "/admin/people";
}

function fieldErrorId(fieldName: string) {
  return `people-${fieldName}-error`;
}

function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: PeopleActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  if (!message) {
    return null;
  }

  return (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  );
}

function fieldProps(fieldName: string, state: PeopleActionState) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

function stateValue(
  state: PeopleActionState,
  fieldName: string,
  fallback: number | string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function FormErrorSummary({ state }: { state: PeopleActionState }) {
  if (!state.error) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
      role="alert"
    >
      {state.error}
    </div>
  );
}

function DrawerSubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function usePeopleFormFeedback(
  activeSection: "owners" | "profiles" | "rooms",
  state: PeopleActionState,
  formRef: React.RefObject<HTMLFormElement | null>,
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const field = formRef.current?.elements.namedItem(firstInvalidField);
      const element =
        field instanceof RadioNodeList ? field[0] : field instanceof HTMLElement ? field : null;

      element?.focus();
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    if (state.success) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("mode");
      params.delete("type");
      params.delete("id");
      params.set("tab", activeSection);
      params.set("feedback", "success");
      params.set("message", state.success);
      const query = params.toString();

      router.replace(query ? `/admin/people?${query}` : "/admin/people");
      router.refresh();
    }
  }, [activeSection, formRef, router, searchParams, state]);
}

function RoomForm({
  closeHref,
  mode,
  room,
}: {
  closeHref: string;
  mode: "create" | "edit";
  room?: Room;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    mode === "create" ? createRoomWithState : updateRoomWithState,
    emptyState,
  );
  usePeopleFormFeedback("rooms", state, formRef);

  return (
    <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
      <RequiredNote />
      <FormErrorSummary state={state} />
      {room ? <input name="id" type="hidden" value={room.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>Room number</FieldLabel>
        <input
          autoFocus
          aria-required="true"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "room_number", room?.room_number)}
          name="room_number"
          {...fieldProps("room_number", state)}
        />
        <FieldError fieldName="room_number" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>Ownership %</FieldLabel>
        <input
          aria-required="true"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "ownership_percent",
            room?.ownership_percent,
          )}
          name="ownership_percent"
          step="0.000001"
          type="number"
          {...fieldProps("ownership_percent", state)}
        />
        <FieldError fieldName="ownership_percent" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Building
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "building", room?.building)}
          name="building"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Floor
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "floor", room?.floor)}
          name="floor"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Area size
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "area_size", room?.area_size)}
          name="area_size"
          step="0.01"
          type="number"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <DrawerSubmitButton pendingLabel={mode === "create" ? "Adding..." : "Saving..."}>
          {mode === "create" ? "Create room" : "Save changes"}
        </DrawerSubmitButton>
        <FormResetButton label={mode === "create" ? "Clear form" : "Reset changes"} />
        <Link
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          href={closeHref}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function OwnerForm({
  closeHref,
  mode,
  owner,
}: {
  closeHref: string;
  mode: "create" | "edit";
  owner?: Owner;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    mode === "create" ? createOwnerWithState : updateOwnerWithState,
    emptyState,
  );
  usePeopleFormFeedback("owners", state, formRef);

  return (
    <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
      <RequiredNote />
      <FormErrorSummary state={state} />
      {owner ? <input name="id" type="hidden" value={owner.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>Full name</FieldLabel>
        <input
          autoFocus
          aria-required="true"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "full_name", owner?.full_name)}
          name="full_name"
          {...fieldProps("full_name", state)}
        />
        <FieldError fieldName="full_name" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "email", owner?.email)}
          name="email"
          type="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Phone
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "phone", owner?.phone)}
          name="phone"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        LINE ID
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "line_id", owner?.line_id)}
          name="line_id"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <DrawerSubmitButton pendingLabel={mode === "create" ? "Adding..." : "Saving..."}>
          {mode === "create" ? "Create owner" : "Save changes"}
        </DrawerSubmitButton>
        <FormResetButton label={mode === "create" ? "Clear form" : "Reset changes"} />
        <Link
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          href={closeHref}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ProfileAccessForm({
  appRoles,
  closeHref,
  profile,
}: {
  appRoles: AppRole[];
  closeHref: string;
  profile: Profile;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    updateProfileAccessWithState,
    emptyState,
  );
  usePeopleFormFeedback("profiles", state, formRef);

  return (
    <div className="grid gap-5">
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        <FormErrorSummary state={state} />
        <input name="id" type="hidden" value={profile.id} />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Default status</FieldLabel>
          <select
            autoFocus
            aria-required="true"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "default_status", profile.default_status)}
            name="default_status"
            {...fieldProps("default_status", state)}
          >
            <option value="owner">Owner</option>
            <option value="resident">Resident</option>
            <option value="proxy">Proxy</option>
          </select>
          <FieldError fieldName="default_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Approval status</FieldLabel>
          <select
            aria-required="true"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "approval_status",
              profile.approval_status,
            )}
            name="approval_status"
            {...fieldProps("approval_status", state)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <FieldError fieldName="approval_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Grant role
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "role")}
            name="role"
          >
            <option value="">No new role</option>
            <option value="admin">Admin</option>
            <option value="committee">Committee</option>
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <DrawerSubmitButton pendingLabel="Saving...">
            Save changes
          </DrawerSubmitButton>
          <FormResetButton label="Reset changes" />
          <Link
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            Cancel
          </Link>
        </div>
      </form>

      <section className="rounded-md border border-[var(--border)] p-3">
        <h3 className="text-sm font-semibold">Current app roles</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {appRoles.length ? (
            appRoles.map((role) => (
              <form
                action={revokeAppRole}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                key={role.id}
              >
                <span>{role.role}</span>
                <input name="id" type="hidden" value={role.id} />
                <ConfirmSubmitButton
                  className="text-xs font-medium text-red-700"
                  confirmMessage={`Revoke role "${role.role}" from ${profile.full_name}? This removes that app permission immediately.`}
                  pendingLabel="Revoking..."
                  type="submit"
                >
                  Revoke
                </ConfirmSubmitButton>
              </form>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No app roles assigned.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function PeopleCrudPilot({
  activeSection,
  appRolesByProfile,
  drawer,
  owners,
  profiles,
  rooms,
}: PeopleCrudPilotProps) {
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
  const selectedOwner = owners.find((owner) => owner.id === drawer?.id);
  const selectedProfile = profiles.find((profile) => profile.id === drawer?.id);
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
        summary: ["New room master data"],
        title: "Add room",
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "room" && selectedRoom) {
      return {
        content: <RoomForm closeHref={closeHref} mode="edit" room={selectedRoom} />,
        summary: [
          `Room: ${selectedRoom.room_number}`,
          `Status: ${selectedRoom.active ? "Active" : "Inactive"}`,
        ],
        title: "Edit room",
      };
    }

    if (drawer?.mode === "create" && drawer.type === "owner") {
      return {
        content: <OwnerForm closeHref={closeHref} mode="create" />,
        summary: ["New owner record"],
        title: "Add owner",
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "owner" && selectedOwner) {
      return {
        content: (
          <OwnerForm closeHref={closeHref} mode="edit" owner={selectedOwner} />
        ),
        summary: [
          `Name: ${selectedOwner.full_name}`,
          `Email: ${selectedOwner.email ?? "-"}`,
          `Status: ${selectedOwner.active ? "Active" : "Inactive"}`,
        ],
        title: "Edit owner",
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "profile" && selectedProfile) {
      return {
        content: (
          <ProfileAccessForm
            appRoles={appRolesByProfile.get(selectedProfile.id) ?? []}
            closeHref={closeHref}
            profile={selectedProfile}
          />
        ),
        summary: [
          `Name: ${selectedProfile.full_name}`,
          `Email: ${selectedProfile.email}`,
          `Status: ${selectedProfile.default_status} / ${selectedProfile.approval_status}`,
        ],
        title: "Edit roles/status",
      };
    }

    return null;
  }, [
    activeSection,
    appRolesByProfile,
    closeHref,
    drawer?.mode,
    drawer?.type,
    selectedOwner,
    selectedProfile,
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

  if (activeSection === "profiles") {
    return (
      <>
        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Registered Profiles</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Default status</th>
                  <th className="py-2 pr-3 font-medium">Approval</th>
                  <th className="py-2 pr-3 font-medium">Roles</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const profileRoles = appRolesByProfile.get(profile.id) ?? [];
                  const selected =
                    drawer?.mode === "edit" &&
                    drawer.type === "profile" &&
                    drawer.id === profile.id;

                  return (
                    <tr
                      className={[
                        "border-b border-[var(--border)]",
                        selected
                          ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                          : "",
                      ].join(" ")}
                      key={profile.id}
                    >
                      <td className="py-2 pr-3">{profile.full_name}</td>
                      <td className="py-2 pr-3">{profile.email}</td>
                      <td className="py-2 pr-3">{profile.default_status}</td>
                      <td className="py-2 pr-3">{profile.approval_status}</td>
                      <td className="py-2 pr-3">
                        {profileRoles.map((role) => role.role).join(", ") || "-"}
                      </td>
                      <td className="py-2">
                        <Link
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          href={buildHref({
                            id: profile.id,
                            mode: "edit",
                            tab: "profiles",
                            type: "profile",
                          })}
                        >
                          Edit roles/status
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {profiles.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No profiles have logged in yet.
            </p>
          ) : null}
        </section>
        {drawerContent ? (
          <AdminCrudDrawer
            closeHref={closeHref}
            summary={drawerContent.summary}
            title={drawerContent.title}
          >
            {drawerContent.content}
          </AdminCrudDrawer>
        ) : null}
      </>
    );
  }

  if (activeSection === "owners") {
    return (
      <>
        <div className="grid gap-5">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <h2 className="text-lg font-semibold">Owners Master Data</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Maintain owner records used for room ownership links and voting
                  eligibility.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  href={buildHref({ mode: "create", tab: "owners", type: "owner" })}
                >
                  Add owner
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                  href="/admin/people/import"
                >
                  Import Master Data
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="text-[var(--primary)]" size={20} />
              <h2 className="text-lg font-semibold">Owners</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => {
                    const selected =
                      drawer?.mode === "edit" &&
                      drawer.type === "owner" &&
                      drawer.id === owner.id;

                    return (
                      <tr
                        className={[
                          "border-b border-[var(--border)]",
                          selected
                            ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                            : "",
                        ].join(" ")}
                        key={owner.id}
                      >
                        <td className="py-2 pr-3">{owner.full_name}</td>
                        <td className="py-2 pr-3">{owner.email ?? "-"}</td>
                        <td className="py-2 pr-3">
                          {owner.active ? "Active" : "Inactive"}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                              href={buildHref({
                                id: owner.id,
                                mode: "edit",
                                tab: "owners",
                                type: "owner",
                              })}
                            >
                              Edit
                            </Link>
                            <form
                              action={
                                owner.active ? deactivateOwner : reactivateOwner
                              }
                            >
                              <input name="id" type="hidden" value={owner.id} />
                              <ConfirmSubmitButton
                                className={
                                  owner.active
                                    ? "text-sm font-medium text-red-700"
                                    : "text-sm font-medium text-[var(--primary)]"
                                }
                                confirmMessage={
                                  owner.active
                                    ? `Deactivate owner "${owner.full_name}"? This owner will no longer be available for new active room ownership links.`
                                    : `Reactivate owner "${owner.full_name}"? This owner will become available for room ownership links.`
                                }
                                pendingLabel={
                                  owner.active
                                    ? "Deactivating..."
                                    : "Reactivating..."
                                }
                                type="submit"
                              >
                                {owner.active ? "Deactivate" : "Reactivate"}
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
          </section>
        </div>

        {drawerContent ? (
          <AdminCrudDrawer
            closeHref={closeHref}
            summary={drawerContent.summary}
            title={drawerContent.title}
          >
            {drawerContent.content}
          </AdminCrudDrawer>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-5">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold">Rooms Master Data</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Maintain room records used before linking ownership in the
                Ownership workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                href={buildHref({ mode: "create", tab: "rooms", type: "room" })}
              >
                Add room
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                href="/admin/people/import"
              >
                Import Master Data
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Search Criteria</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Filter rooms by room number and active status.
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
              Room
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setRoomCriteria((current) => ({ ...current, room: value }));
                }}
                placeholder="Search room number"
                value={roomCriteria.room}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
              Status
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget.value as RoomTableState["status"];

                  setRoomCriteria((current) => ({ ...current, status: value }));
                }}
                value={roomCriteria.status}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-4">
              <button
                className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                type="submit"
              >
                Search
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
                Clear
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
                  <h2 className="text-lg font-semibold">Rooms</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Showing {roomPageStart}-{roomPageEnd} of {roomTotal}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                  <span>Page</span>
                  <select
                    aria-label="Page"
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
                  <span>Per page</span>
                  <select
                    aria-label="Per page"
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
                      Room
                      {roomTableState.sort === "room"
                        ? roomTableState.dir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th className="py-2 pr-3 font-medium">Owner %</th>
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
                      Status
                      {roomTableState.sort === "status"
                        ? roomTableState.dir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRooms.map((room) => {
                  const selected =
                    drawer?.mode === "edit" &&
                    drawer.type === "room" &&
                    drawer.id === room.id;

                  return (
                    <tr
                      className={[
                        "border-b border-[var(--border)]",
                        selected
                          ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                          : "",
                      ].join(" ")}
                      key={room.id}
                    >
                      <td className="py-2 pr-3">{room.room_number}</td>
                      <td className="py-2 pr-3">{room.ownership_percent}</td>
                      <td className="py-2 pr-3">
                        {room.active ? "Active" : "Inactive"}
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
                            Edit
                          </Link>
                          <form
                            action={room.active ? deactivateRoom : reactivateRoom}
                          >
                            <input name="id" type="hidden" value={room.id} />
                            <ConfirmSubmitButton
                              className={
                                room.active
                                  ? "text-sm font-medium text-red-700"
                                  : "text-sm font-medium text-[var(--primary)]"
                              }
                              confirmMessage={
                                room.active
                                  ? `Deactivate room "${room.room_number}"? This room will no longer be available for active ownership or voting setup.`
                                  : `Reactivate room "${room.room_number}"? This room will become available for active ownership and voting setup.`
                              }
                              pendingLabel={
                                room.active ? "Deactivating..." : "Reactivating..."
                              }
                              type="submit"
                            >
                              {room.active ? "Deactivate" : "Reactivate"}
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
              No rooms match the selected criteria.
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
              Previous
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
              Next
            </button>
          </div>
        </section>

      </div>

      {drawerContent ? (
        <AdminCrudDrawer
          closeHref={closeHref}
          summary={drawerContent.summary}
          title={drawerContent.title}
        >
          {drawerContent.content}
        </AdminCrudDrawer>
      ) : null}
    </>
  );
}
