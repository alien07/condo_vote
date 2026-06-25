"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  resolveManualBallotIdentityWithState,
  startManualVoteImportWithState,
  type ManualVoteActionState,
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

type ProfileOption = {
  email: string;
  full_name: string | null;
  id: string;
};

type RoomOption = {
  active: boolean | null;
  id: string;
  room_number: string;
};

type PendingManualBallot = {
  audit_note: string | null;
  id: string;
  meetings: { title: string } | null;
  rooms: { room_number: string } | null;
  voter_identity_text: string | null;
};

type ManualVoteImportDrawerProps = {
  closeHref: string;
  meetings: MeetingOption[];
  profiles: ProfileOption[];
  rooms: RoomOption[];
};

type ManualVoteIdentityDrawerProps = {
  closeHref: string;
  manualBallot: PendingManualBallot;
  profiles: ProfileOption[];
};

const emptyState: ManualVoteActionState = {};

function fieldErrorId(fieldName: string) {
  return `manual-vote-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: ManualVoteActionState) {
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
  state: ManualVoteActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: ManualVoteActionState,
  fieldName: string,
  fallback: string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function focusFirstInvalidField(
  form: HTMLFormElement | null,
  state: ManualVoteActionState,
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

function ActionMessage({ state }: { state: ManualVoteActionState }) {
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

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function ManualVoteRowFocus({
  manualBallotId,
}: {
  manualBallotId?: string | null;
}) {
  useEffect(() => {
    if (!manualBallotId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-manual-ballot-id="${escapeSelectorValue(manualBallotId)}"]`,
      );

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [manualBallotId]);

  return null;
}

export function ManualVoteImportDrawer({
  closeHref,
  meetings,
  profiles,
  rooms,
}: ManualVoteImportDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    startManualVoteImportWithState,
    emptyState,
  );

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
      return;
    }

    if (!state.redirectHref) {
      return;
    }

    window.location.assign(state.redirectHref);
  }, [state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={["Manual vote entry setup"]}
      title="Import manual vote"
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        <ActionMessage state={state} />
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
          Voter profile
          <select
            {...fieldProps("voter_profile_id", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "voter_profile_id")}
            name="voter_profile_id"
          >
            <option value="">Use pending free-text identity</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.email} ({profile.email})
              </option>
            ))}
          </select>
          <FieldError fieldName="voter_profile_id" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Pending voter identity
          <input
            {...fieldProps("voter_identity_text", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "voter_identity_text")}
            name="voter_identity_text"
            placeholder="Name on paper ballot when profile is not registered yet"
          />
          <FieldError fieldName="voter_identity_text" state={state} />
        </label>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          If only a free-text identity is entered, the manual vote is saved as
          draft/pending and will not be used in result calculation until the
          voter is registered and linked to a profile.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel="Opening..."
            type="submit"
          >
            Continue to vote form
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
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

export function ManualVoteIdentityDrawer({
  closeHref,
  manualBallot,
  profiles,
}: ManualVoteIdentityDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    resolveManualBallotIdentityWithState,
    emptyState,
  );

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
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
    params.set("focusManualBallotId", state.recordId);

    window.location.assign(`/admin/voting?${params.toString()}`);
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        `Meeting: ${manualBallot.meetings?.title ?? "-"}`,
        `Room: ${manualBallot.rooms?.room_number ?? "-"}`,
        `Captured: ${
          manualBallot.voter_identity_text ?? manualBallot.audit_note ?? "-"
        }`,
      ]}
      title="Resolve manual vote identity"
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        <ActionMessage state={state} />
        <input name="id" type="hidden" value={manualBallot.id} />
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Select the registered profile that matches the paper ballot identity.
          After saving, this manual vote becomes submitted and can be used in
          result generation and committee approval.
        </p>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Voter profile</FieldLabel>
          <select
            {...fieldProps("voter_profile_id", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "voter_profile_id")}
            name="voter_profile_id"
            required
          >
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.email} ({profile.email})
              </option>
            ))}
          </select>
          <FieldError fieldName="voter_profile_id" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <ConfirmSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            confirmMessage={`Link pending manual vote identity "${
              manualBallot.voter_identity_text ??
              manualBallot.audit_note ??
              "this identity"
            }" to the selected profile? This makes the manual vote eligible for result calculation.`}
            pendingLabel="Saving..."
            type="submit"
          >
            Link profile
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
