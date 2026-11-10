"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { codeLabel, fill } from "@/lib/i18n/template";
import { isoToBangkokLocalInput } from "@/lib/datetime";
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
  advance_starts_at?: string | null;
  advance_ends_at?: string | null;
  fiscal_year: string | null;
  id: string;
  location: string | null;
  meeting_number: string | null;
  meeting_type: string;
  quorum_rule: string;
  required_approvals?: number;
  ballot_secrecy?: string;
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

// Bangkok time, so the server render and the browser agree.
const formatDateTimeLocal = isoToBangkokLocalInput;

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
  const tm = useMessageText();
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {tm(message)}
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
  const tm = useMessageText();
  const { s } = useStaffText();
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
          ? [
              fill(s.meetings.meetingSummary, { title: meeting.title }),
              fill(s.meetings.statusSummary, { status: codeLabel(s.common.code, meeting.status) }),
            ]
          : [s.meetings.newMeeting]
      }
      title={mode === "edit" ? s.meetings.editMeeting : s.meetings.add}
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        {state.error ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="alert"
          >
            {tm(state.error)}
          </div>
        ) : null}
        {mode === "edit" && meeting ? (
          <input name="id" type="hidden" value={meeting.id} />
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.meetingTitle}</FieldLabel>
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
          placeholder={s.meetings.videoUrl}
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
          placeholder={s.meetings.meetingNo}
        />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.meetingType}</FieldLabel>
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
            <option value="online_vote">{s.meetings.onlineVote}</option>
            <option value="agm">{s.meetings.agm}</option>
            <option value="egm">{s.meetings.egm}</option>
            <option value="committee">{s.meetings.committeeType}</option>
          </select>
          <FieldError fieldName="meeting_type" state={state} />
        </label>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "fiscal_year", meeting?.fiscal_year)}
          name="fiscal_year"
          placeholder={s.meetings.fiscalYear}
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "location", meeting?.location)}
          name="location"
          placeholder={s.meetings.location}
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "chairperson_name",
            meeting?.chairperson_name,
          )}
          name="chairperson_name"
          placeholder={s.meetings.chairperson}
        />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.quorumRule}</FieldLabel>
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
              {s.meetings.quorumQuarter}
            </option>
            <option value="not_required_second_call">
              {s.meetings.quorumNone}
            </option>
            <option value="committee_policy">{s.meetings.quorumCommittee}</option>
          </select>
          <FieldError fieldName="quorum_rule" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.approvalsNeeded}</FieldLabel>
          <input
            {...fieldProps("required_approvals", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "required_approvals",
              String(meeting?.required_approvals ?? 1),
            )}
            max={20}
            min={1}
            name="required_approvals"
            type="number"
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            {s.meetings.approvalsHelp}
          </span>
          <FieldError fieldName="required_approvals" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.ballot}</FieldLabel>
          <select
            {...fieldProps("ballot_secrecy", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:bg-[var(--background)]"
            defaultValue={stateValue(
              state,
              "ballot_secrecy",
              meeting?.ballot_secrecy ?? "open",
            )}
            disabled={Boolean(meeting && meeting.status !== "draft")}
            name="ballot_secrecy"
          >
            <option value="open">{s.meetings.openBallot}</option>
            <option value="secret">{s.meetings.secretBallot}</option>
          </select>
          <span className="text-xs font-normal text-[var(--muted)]">
            {s.meetings.ballotLocked}
          </span>
          <FieldError fieldName="ballot_secrecy" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.meetings.dayStarts}</FieldLabel>
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
          <FieldLabel required>{s.meetings.dayEnds}</FieldLabel>
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
        <fieldset className="grid gap-3 rounded-md border border-[var(--border)] p-3">
          <legend className="px-1 text-sm font-medium">{s.meetings.advance}</legend>
          <p className="text-xs text-[var(--muted)]">
            {s.meetings.advanceHelp}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              {s.meetings.advanceStarts}
              <input
                {...fieldProps("advance_starts_at", state)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(
                  state,
                  "advance_starts_at",
                  formatDateTimeLocal(meeting?.advance_starts_at),
                )}
                name="advance_starts_at"
                step={600}
                type="datetime-local"
              />
              <FieldError fieldName="advance_starts_at" state={state} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {s.meetings.advanceEnds}
              <input
                {...fieldProps("advance_ends_at", state)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={stateValue(
                  state,
                  "advance_ends_at",
                  formatDateTimeLocal(meeting?.advance_ends_at),
                )}
                name="advance_ends_at"
                step={600}
                type="datetime-local"
              />
              <FieldError fieldName="advance_ends_at" state={state} />
            </label>
          </div>
        </fieldset>
        <textarea
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "description", meeting?.description)}
          name="description"
          placeholder={s.meetings.description}
          rows={3}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={mode === "edit" ? s.common.saving : s.meetings.adding}
            type="submit"
          >
            {mode === "edit" ? s.meetings.saveMeeting : s.meetings.add}
          </PendingSubmitButton>
          <FormResetButton
            label={mode === "edit" ? "Reset changes" : "Clear form"}
          />
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            {s.common.cancel}
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}
