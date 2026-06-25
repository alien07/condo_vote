"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  approveResultSnapshotWithState,
  type ResultApprovalActionState,
} from "@/features/admin/actions";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FormResetButton, ConfirmSubmitButton } from "@/features/admin/components/form-controls";

type ResultSnapshot = {
  generated_at: string;
  id: string;
  meeting_id: string;
  meetings: { title: string } | null;
};

type ResultApprovalDrawerProps = {
  closeHref: string;
  generatedLabel: string;
  pendingManualCount: number;
  snapshot: ResultSnapshot;
};

const emptyState: ResultApprovalActionState = {};

function fieldErrorId(fieldName: string) {
  return `result-approval-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: ResultApprovalActionState) {
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
  state: ResultApprovalActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: ResultApprovalActionState,
  fieldName: string,
  fallback = "",
) {
  return state.values?.[fieldName] ?? fallback;
}

function focusFirstInvalidField(
  form: HTMLFormElement | null,
  state: ResultApprovalActionState,
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

function ActionMessage({ state }: { state: ResultApprovalActionState }) {
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

export function ResultSnapshotRowFocus({
  snapshotId,
}: {
  snapshotId?: string | null;
}) {
  useEffect(() => {
    if (!snapshotId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-result-snapshot-id="${escapeSelectorValue(snapshotId)}"]`,
      );

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [snapshotId]);

  return null;
}

export function ResultApprovalDrawer({
  closeHref,
  generatedLabel,
  pendingManualCount,
  snapshot,
}: ResultApprovalDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    approveResultSnapshotWithState,
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
    params.set("focusResultSnapshotId", state.recordId);

    router.replace(`/admin/results?${params.toString()}`, { scroll: false });
    router.refresh();
  }, [router, searchParams, state]);

  if (state.success && state.recordId) {
    return null;
  }

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        `Meeting: ${snapshot.meetings?.title ?? "-"}`,
        `Generated: ${generatedLabel}`,
      ]}
      title="Approve result"
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <ActionMessage state={state} />
        <input name="meeting_id" type="hidden" value={snapshot.meeting_id} />
        <input name="result_snapshot_id" type="hidden" value={snapshot.id} />
        {pendingManualCount > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Resolve {pendingManualCount} pending manual vote identity record(s)
            before committee approval. Go to{" "}
            <a className="font-medium underline" href="/admin/voting">
              Admin &gt; Voting &gt; Manual votes
            </a>{" "}
            to fix them.
          </div>
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          Approval / conflict notes
          <textarea
            {...fieldProps("notes", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "notes")}
            name="notes"
            rows={4}
          />
          <FieldError fieldName="notes" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          {pendingManualCount > 0 ? (
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] opacity-60"
              disabled
              type="button"
            >
              Approval blocked
            </button>
          ) : (
            <ConfirmSubmitButton
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              confirmMessage={`Approve result for "${snapshot.meetings?.title ?? "this meeting"}"? This locks the approved result snapshot as the source of truth.`}
              pendingLabel="Saving..."
              type="submit"
            >
              Approve result
            </ConfirmSubmitButton>
          )}
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
