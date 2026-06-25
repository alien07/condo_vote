"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  createProxyAuthorizationWithState,
  reviewProxyAuthorizationWithState,
  type ProxyActionState,
} from "@/features/admin/actions";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type MeetingOption = {
  id: string;
  status: string;
  title: string;
};

type OwnerOption = {
  active: boolean;
  full_name: string;
  id: string;
};

type ProfileOption = {
  email: string;
  full_name: string | null;
  id: string;
};

type RoomOption = {
  active: boolean;
  id: string;
  room_number: string;
};

type ProxyAuthorization = {
  id: string;
  status: string;
  meetings: { title: string } | null;
  rooms: { room_number: string } | null;
  owners: { full_name: string } | null;
  profiles: { email: string; full_name: string | null } | null;
};

type ProxyCrudDrawerProps = {
  authorization?: ProxyAuthorization;
  closeHref: string;
  meetings: MeetingOption[];
  mode: "create" | "edit";
  owners: OwnerOption[];
  profiles: ProfileOption[];
  rooms: RoomOption[];
};

const emptyState: ProxyActionState = {};

function fieldErrorId(fieldName: string) {
  return `proxy-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: ProxyActionState) {
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
  state: ProxyActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: ProxyActionState,
  fieldName: string,
  fallback: string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function ProxyRowFocus({
  authorizationId,
}: {
  authorizationId?: string | null;
}) {
  useEffect(() => {
    if (!authorizationId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const selector = `[data-proxy-id="${escapeSelectorValue(authorizationId)}"]`;
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
  }, [authorizationId]);

  return null;
}

export function ProxyCrudDrawer({
  authorization,
  closeHref,
  meetings,
  mode,
  owners,
  profiles,
  rooms,
}: ProxyCrudDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    mode === "edit"
      ? reviewProxyAuthorizationWithState
      : createProxyAuthorizationWithState,
    emptyState,
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

    if (!state.success || !state.recordId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.delete("mode");
    params.delete("type");
    params.delete("id");
    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusProxyId", state.recordId);

    window.location.assign(`/admin/proxies?${params.toString()}`);
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={
        mode === "edit" && authorization
          ? [
              `Meeting: ${authorization.meetings?.title ?? "-"}`,
              `Room: ${authorization.rooms?.room_number ?? "-"}`,
              `Proxy: ${authorization.profiles?.full_name ?? "-"}`,
            ]
          : ["New proxy authorization"]
      }
      title={mode === "edit" ? "Review proxy authorization" : "Add proxy authorization"}
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        {state.error ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="alert"
          >
            {state.error}
          </div>
        ) : null}
        {mode === "edit" && authorization ? (
          <input name="id" type="hidden" value={authorization.id} />
        ) : null}

        {mode === "create" ? (
          <>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Meeting</FieldLabel>
              <select
                {...fieldProps("meeting_id", state)}
                autoFocus
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "meeting_id")}
                name="meeting_id"
                required
              >
                <option value="">Select meeting</option>
                {meetings
                  .filter((meeting) => meeting.status !== "archived")
                  .map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </option>
                  ))}
              </select>
              <FieldError fieldName="meeting_id" state={state} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Room</FieldLabel>
              <select
                {...fieldProps("room_id", state)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "room_id")}
                name="room_id"
                required
              >
                <option value="">Select room</option>
                {rooms
                  .filter((room) => room.active)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
              </select>
              <FieldError fieldName="room_id" state={state} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Owner
              <select
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "owner_id")}
                name="owner_id"
              >
                <option value="">Owner optional</option>
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
              <FieldLabel required>Proxy profile</FieldLabel>
              <select
                {...fieldProps("proxy_profile_id", state)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "proxy_profile_id")}
                name="proxy_profile_id"
                required
              >
                <option value="">Select proxy profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email} ({profile.email})
                  </option>
                ))}
              </select>
              <FieldError fieldName="proxy_profile_id" state={state} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Valid from
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "valid_from")}
                name="valid_from"
                type="date"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Valid until
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(state, "valid_until")}
                name="valid_until"
                type="date"
              />
            </label>
          </>
        ) : (
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>Status</FieldLabel>
            <select
              {...fieldProps("status", state)}
              autoFocus
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={stateValue(state, "status", authorization?.status)}
              name="status"
              required
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revoked">Revoked</option>
            </select>
            <FieldError fieldName="status" state={state} />
          </label>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {mode === "edit" ? (
            <ConfirmSubmitButton
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              confirmMessage={`Update proxy authorization for room ${authorization?.rooms?.room_number ?? "-"}? Approving, rejecting, or revoking changes who can vote for this room.`}
              pendingLabel="Saving..."
              type="submit"
            >
              Save review
            </ConfirmSubmitButton>
          ) : (
            <PendingSubmitButton
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              pendingLabel="Adding..."
              type="submit"
            >
              Add proxy authorization
            </PendingSubmitButton>
          )}
          <FormResetButton label={mode === "edit" ? "Reset changes" : "Clear form"} />
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
