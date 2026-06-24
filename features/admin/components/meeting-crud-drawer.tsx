"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  createMeetingWithState,
  updateDraftMeetingWithState,
  type MeetingActionState,
} from "@/features/admin/actions";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type MeetingRecord = {
  chairperson_name: string | null;
  description: string | null;
  ends_at: string;
  fiscal_year: string | null;
  id: string;
  location: string | null;
  meeting_number: string | null;
  meeting_type: string;
  quorum_rule: string;
  starts_at: string;
  status: string;
  title: string;
  video_url: string | null;
};

type MeetingCrudDrawerProps = {
  closeHref: string;
  meeting?: MeetingRecord;
  mode: "create" | "edit";
};

const emptyState: MeetingActionState = {};

function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fieldErrorId(fieldName: string) {
  return `meeting-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: MeetingActionState) {
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
  state: MeetingActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: MeetingActionState,
  fieldName: string,
  fallback: string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? fallback ?? "";
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function MeetingRowFocus({ meetingId }: { meetingId?: string | null }) {
  useEffect(() => {
    if (!meetingId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const selector = `[data-meeting-id="${escapeSelectorValue(meetingId)}"]`;
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
  }, [meetingId]);

  return null;
}

export function MeetingCrudDrawer({
  closeHref,
  meeting,
  mode,
}: MeetingCrudDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    mode === "edit" ? updateDraftMeetingWithState : createMeetingWithState,
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
    params.set("tab", "meetings");
    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusMeetingId", state.recordId);

    if (mode === "create" && state.values?.title) {
      params.set("title", state.values.title);
      params.delete("noType");
      params.delete("status");
      params.delete("page");
    }

    window.location.assign(`/admin/meetings?${params.toString()}`);
  }, [mode, searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={
        mode === "edit" && meeting
          ? [`Meeting: ${meeting.title}`, `Status: ${meeting.status}`]
          : ["New meeting"]
      }
      title={mode === "edit" ? "Edit meeting" : "Add meeting"}
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
        {mode === "edit" && meeting ? (
          <input name="id" type="hidden" value={meeting.id} />
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Meeting title</FieldLabel>
          <input
            {...fieldProps("title", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "title", meeting?.title)}
            name="title"
          />
          <FieldError fieldName="title" state={state} />
        </label>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "video_url", meeting?.video_url)}
          name="video_url"
          placeholder="Video URL"
          type="url"
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "meeting_number",
            meeting?.meeting_number,
          )}
          name="meeting_number"
          placeholder="Meeting no."
        />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Meeting type</FieldLabel>
          <select
            {...fieldProps("meeting_type", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "meeting_type",
              meeting?.meeting_type ?? "online_vote",
            )}
            name="meeting_type"
          >
            <option value="online_vote">Online vote</option>
            <option value="agm">AGM</option>
            <option value="egm">EGM</option>
            <option value="committee">Committee</option>
          </select>
          <FieldError fieldName="meeting_type" state={state} />
        </label>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "fiscal_year", meeting?.fiscal_year)}
          name="fiscal_year"
          placeholder="Fiscal year"
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "location", meeting?.location)}
          name="location"
          placeholder="Location / platform"
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "chairperson_name",
            meeting?.chairperson_name,
          )}
          name="chairperson_name"
          placeholder="Chairperson"
        />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Quorum rule</FieldLabel>
          <select
            {...fieldProps("quorum_rule", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "quorum_rule",
              meeting?.quorum_rule ?? "one_fourth_total_ownership",
            )}
            name="quorum_rule"
          >
            <option value="one_fourth_total_ownership">
              Quorum: 1/4 ownership
            </option>
            <option value="not_required_second_call">
              Second call: no quorum
            </option>
            <option value="committee_policy">Committee policy</option>
          </select>
          <FieldError fieldName="quorum_rule" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Starts</FieldLabel>
          <input
            {...fieldProps("starts_at", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "starts_at",
              formatDateTimeLocal(meeting?.starts_at),
            )}
            name="starts_at"
            step={600}
            type="datetime-local"
          />
          <FieldError fieldName="starts_at" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Ends</FieldLabel>
          <input
            {...fieldProps("ends_at", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "ends_at",
              formatDateTimeLocal(meeting?.ends_at),
            )}
            name="ends_at"
            step={600}
            type="datetime-local"
          />
          <FieldError fieldName="ends_at" state={state} />
        </label>
        <textarea
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "description", meeting?.description)}
          name="description"
          placeholder="Description"
          rows={3}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={mode === "edit" ? "Saving..." : "Adding..."}
            type="submit"
          >
            {mode === "edit" ? "Save meeting" : "Add meeting"}
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
