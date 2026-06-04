"use client";

import { useMemo, useActionState, useState } from "react";
import {
  endRoomOwnerLinkWithState,
  linkRoomOwnerWithState,
  type OwnershipActionState,
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
};

type OwnershipManagerProps = {
  drawer?: {
    mode?: string;
    type?: string;
  };
  owners: Owner[];
  roomOwners: RoomOwnerLink[];
  rooms: Room[];
};

const initialState: OwnershipActionState = {};

function todayLocalDate() {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return offsetDate.toISOString().slice(0, 10);
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
  const [createState, createAction] = useActionState(
    linkRoomOwnerWithState,
    initialState,
  );
  const [createClientError, setCreateClientError] = useState<string | null>(null);
  const activeRoomOwnerByRoom = useMemo(
    () =>
      new Map(
        roomOwners
          .filter((link) => !link.ends_at && link.rooms?.id)
          .map((link) => [link.rooms?.id ?? "", link]),
      ),
    [roomOwners],
  );
  const defaultEndDate = todayLocalDate();
  const showCreateDrawer =
    drawer?.mode === "create" && drawer.type === "ownership_link";

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">Room</th>
              <th className="py-2 pr-3 font-medium">Owner</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Dates</th>
              <th className="py-2 font-medium">Manage link</th>
            </tr>
          </thead>
          <tbody>
            {roomOwners.map((link) => (
              <OwnershipRow
                defaultEndDate={defaultEndDate}
                key={link.id}
                link={link}
              />
            ))}
          </tbody>
        </table>
      </div>
      {roomOwners.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No room ownership links have been created yet.
        </p>
      ) : null}
      {showCreateDrawer ? (
        <AdminCrudDrawer
          closeHref="/admin/ownership"
          summary={["New room-owner link"]}
          title="Create ownership link"
        >
          <form
            action={createAction}
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              const formData = new FormData(event.currentTarget);
              const missingFields = [
                formData.get("room_id") ? null : "Room",
                formData.get("owner_id") ? null : "Owner",
                formData.get("ownership_role") ? null : "Ownership role",
              ].filter((field): field is string => Boolean(field));

              if (missingFields.length > 0) {
                event.preventDefault();
                setCreateClientError(
                  `Please complete required fields: ${missingFields.join(", ")}.`,
                );
                return;
              }

              setCreateClientError(null);
            }}
          >
            <RequiredNote />
            <ActionMessage
              state={createClientError ? { error: createClientError } : createState}
            />
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Room</FieldLabel>
              <select
                autoFocus
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
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
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Owner</FieldLabel>
              <select
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
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
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Ownership role</FieldLabel>
              <select
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ownership_role"
                required
              >
                <option value="owner">Owner</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Effective from
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
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
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ends_at"
                type="date"
              />
              <span className="text-xs font-normal text-[var(--muted)]">
                Leave blank for the current active owner.
              </span>
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
                href="/admin/ownership"
              >
                Cancel
              </a>
            </div>
          </form>
        </AdminCrudDrawer>
      ) : null}
    </>
  );
}

function OwnershipRow({
  defaultEndDate,
  link,
}: {
  defaultEndDate: string;
  link: RoomOwnerLink;
}) {
  const [endState, endAction] = useActionState(
    endRoomOwnerLinkWithState,
    initialState,
  );

  return (
    <>
      <tr className="border-b border-[var(--border)]">
        <td className="py-2 pr-3">{link.rooms?.room_number ?? "-"}</td>
        <td className="py-2 pr-3">{link.owners?.full_name ?? "-"}</td>
        <td className="py-2 pr-3">{link.ownership_role}</td>
        <td className="py-2 pr-3">
          {link.starts_at ?? "Not set"} - {link.ends_at ?? "Current"}
        </td>
        <td className="py-2">
          {!link.ends_at ? (
            <form action={endAction} className="flex flex-wrap gap-2">
              <input name="id" type="hidden" value={link.id} />
              <input
                className="w-36 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                defaultValue={defaultEndDate}
                name="ends_at"
                type="date"
              />
              <ConfirmSubmitButton
                className="text-sm font-medium text-red-700"
                confirmMessage={`End ownership link for room ${link.rooms?.room_number ?? "-"} and owner ${link.owners?.full_name ?? "-"}? This owner will no longer be active for that room after the selected end date.`}
                debugName="admin.ownership.end"
                pendingLabel="Saving..."
                type="submit"
              >
                End active link
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </td>
      </tr>
      {endState.error || endState.success ? (
        <tr className="border-b border-[var(--border)]">
          <td className="py-2" colSpan={5}>
            <ActionMessage state={endState} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
