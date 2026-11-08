"use client";

import { useActionState, useRef } from "react";
import { createRoomWithState, updateRoomWithState } from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import Link from "next/link";
import {
  DrawerSubmitButton,
  FieldError,
  FormErrorSummary,
  emptyState,
  fieldProps,
  stateValue,
  usePeopleFormFeedback,
} from "@/features/admin/components/sections/people/people-form-helpers";
import type { Room } from "@/features/admin/components/sections/people/people-types";

export function RoomForm({
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
  usePeopleFormFeedback("rooms", state, formRef, mode);

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
