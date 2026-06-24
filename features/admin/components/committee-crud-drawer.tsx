"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  createCommitteeMemberWithState,
  updateCommitteeMemberWithState,
  type CommitteeActionState,
} from "@/features/admin/actions";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type CommitteeMember = {
  active: boolean;
  display_order: number;
  full_name: string;
  id: string;
  position_title: string;
  profile_id: string | null;
  term_ends_at: string | null;
  term_starts_at: string | null;
};

type ProfileOption = {
  email: string;
  full_name: string | null;
  id: string;
};

type CommitteeCrudDrawerProps = {
  closeHref: string;
  member?: CommitteeMember;
  mode: "create" | "edit";
  profiles: ProfileOption[];
};

const emptyState: CommitteeActionState = {};

function fieldErrorId(fieldName: string) {
  return `committee-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: CommitteeActionState) {
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
  state: CommitteeActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: CommitteeActionState,
  fieldName: string,
  fallback: number | string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function CommitteeRowFocus({ memberId }: { memberId?: string | null }) {
  useEffect(() => {
    if (!memberId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const selector = `[data-committee-id="${escapeSelectorValue(memberId)}"]`;
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
  }, [memberId]);

  return null;
}

export function CommitteeCrudDrawer({
  closeHref,
  member,
  mode,
  profiles,
}: CommitteeCrudDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    mode === "edit"
      ? updateCommitteeMemberWithState
      : createCommitteeMemberWithState,
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
    params.set("tab", "committee");
    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusCommitteeId", state.recordId);

    if (mode === "create" && state.values?.full_name) {
      params.set("memberName", state.values.full_name);
      params.delete("position");
      params.delete("status");
      params.delete("page");
    }

    window.location.assign(`/admin/setup?${params.toString()}`);
  }, [mode, searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={
        mode === "edit" && member
          ? [
              `Committee member: ${member.full_name}`,
              `Position: ${member.position_title}`,
            ]
          : ["New committee member"]
      }
      title={
        mode === "edit" ? "Edit committee member" : "Add committee member"
      }
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
        {mode === "edit" && member ? (
          <input name="id" type="hidden" value={member.id} />
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          Profile
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "profile_id", member?.profile_id)}
            name="profile_id"
          >
            <option value="">Profile optional</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.email} ({profile.email})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Committee name</FieldLabel>
          <input
            {...fieldProps("full_name", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "full_name", member?.full_name)}
            name="full_name"
          />
          <FieldError fieldName="full_name" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Position</FieldLabel>
          <input
            {...fieldProps("position_title", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "position_title",
              member?.position_title,
            )}
            name="position_title"
          />
          <FieldError fieldName="position_title" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Display order
          <input
            {...fieldProps("display_order", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "display_order",
              member?.display_order ?? 0,
            )}
            min={0}
            name="display_order"
            type="number"
          />
          <FieldError fieldName="display_order" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Term starts
          <input
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "term_starts_at",
              member?.term_starts_at,
            )}
            name="term_starts_at"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Term ends
          <input
            {...fieldProps("term_ends_at", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "term_ends_at",
              member?.term_ends_at,
            )}
            name="term_ends_at"
            type="date"
          />
          <FieldError fieldName="term_ends_at" state={state} />
        </label>
        {mode === "edit" ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              defaultChecked={state.values ? state.values.active === "on" : member?.active ?? true}
              name="active"
              type="checkbox"
            />
            Active
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={mode === "edit" ? "Saving..." : "Adding..."}
            type="submit"
          >
            {mode === "edit" ? "Save committee member" : "Add committee member"}
          </PendingSubmitButton>
          <FormResetButton
            label={mode === "edit" ? "Reset changes" : "Clear form"}
          />
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
