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
import { SearchSelect } from "@/features/ui/search-select";

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

type CommitteeMemberOption = {
  active: boolean;
  full_name: string;
  position_title: string;
};

type MeetingCrudDrawerProps = {
  closeHref: string;
  committeeMembers?: CommitteeMemberOption[];
  meeting?: MeetingRecord;
  mode: "create" | "edit";
};

// The committee chair, for a new meeting's chairperson (2026-11-18): an
// active member whose title is chair, not vice chair.
function committeeChair(members: CommitteeMemberOption[]) {
  return members.find(
    (member) =>
      member.active &&
      /ประธาน|chair/i.test(member.position_title) &&
      !/รอง|vice/i.test(member.position_title),
  )?.full_name;
}

const emptyState: MeetingActionState = {};

const groupClass = "grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-4";
const legendClass = "px-1 text-sm font-semibold";
const fieldClass = "grid min-w-0 gap-1 text-sm font-medium";
const inputClass = "min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";

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
  committeeMembers = [],
  meeting,
  mode,
}: MeetingCrudDrawerProps) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const chairOptions = committeeMembers
    .filter((member) => member.active)
    .map((member) => ({
      value: member.full_name,
      label: member.full_name,
      hint: member.position_title,
    }));
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

    // A new meeting: the next step is its agenda (2026-11-18 review).
    if (mode === "create") {
      window.location.assign(
        `/admin/meetings?tab=questions&meeting=${encodeURIComponent(state.recordId)}&feedback=success&message=${encodeURIComponent(state.success)}`,
      );
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
        {/* Three groups, every field labelled (2026-11-18 review). */}
        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.meetings.sectionInfo}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.meetingTitle}</FieldLabel>
            <input
              {...fieldProps("title", state)}
              autoFocus
              className={inputClass}
              defaultValue={stateValue(state, "title", meeting?.title)}
              name="title"
            />
            <FieldError fieldName="title" state={state} />
          </label>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.meetingType}</FieldLabel>
            <select
              {...fieldProps("meeting_type", state)}
              className={inputClass}
              defaultValue={stateValue(
                state,
                "meeting_type",
                meeting?.meeting_type ?? "online_vote",
              )}
              name="meeting_type"
            >
              <option value="online_vote">{s.meetings.onlineVote}</option>
              <option value="first_general">{s.meetings.firstGeneral}</option>
              <option value="agm">{s.meetings.agm}</option>
              <option value="egm">{s.meetings.egm}</option>
              <option value="committee">{s.meetings.committeeType}</option>
            </select>
            <FieldError fieldName="meeting_type" state={state} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={fieldClass}>
              {s.meetings.meetingNo}
              <input
                {...fieldProps("meeting_number", state)}
                className={inputClass}
                defaultValue={stateValue(state, "meeting_number", meeting?.meeting_number)}
                name="meeting_number"
                placeholder={s.meetings.meetingNoHint}
              />
              <FieldError fieldName="meeting_number" state={state} />
            </label>
            <label className={fieldClass}>
              {s.meetings.fiscalYear}
              <input
                {...fieldProps("fiscal_year", state)}
                className={inputClass}
                defaultValue={stateValue(state, "fiscal_year", meeting?.fiscal_year)}
                inputMode="numeric"
                maxLength={4}
                name="fiscal_year"
                placeholder={s.meetings.fiscalYearHint}
              />
              <FieldError fieldName="fiscal_year" state={state} />
            </label>
          </div>
          <label className={fieldClass}>
            {s.meetings.chairperson}
            {/* Pick a committee member or type another name (2026-11-18). */}
            <SearchSelect
              allowCustom
              defaultValue={stateValue(
                state,
                "chairperson_name",
                meeting ? meeting.chairperson_name : committeeChair(committeeMembers),
              )}
              name="chairperson_name"
              options={chairOptions}
              text={{
                clear: s.common.searchClear,
                more: s.common.searchMore,
                noResults: s.common.searchNoResults,
                placeholder: s.meetings.chairpersonPick,
                useTyped: s.common.searchUseTyped,
              }}
            />
          </label>
          <label className={fieldClass}>
            {s.meetings.location}
            <input
              className={inputClass}
              defaultValue={stateValue(state, "location", meeting?.location)}
              name="location"
            />
          </label>
          <label className={fieldClass}>
            {s.meetings.videoUrl}
            <input
              {...fieldProps("video_url", state)}
              className={inputClass}
              defaultValue={stateValue(state, "video_url", meeting?.video_url)}
              name="video_url"
              placeholder="https://"
              type="url"
            />
            <FieldError fieldName="video_url" state={state} />
          </label>
          <label className={fieldClass}>
            {s.meetings.description}
            <textarea
              className={inputClass}
              defaultValue={stateValue(state, "description", meeting?.description)}
              name="description"
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.meetings.sectionVoting}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.ballot}</FieldLabel>
            <select
              {...fieldProps("ballot_secrecy", state)}
              className={`${inputClass} disabled:bg-[var(--background)]`}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={fieldClass}>
              <FieldLabel required>{s.meetings.dayStarts}</FieldLabel>
              <input
                {...fieldProps("starts_at", state)}
                className={inputClass}
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
            <label className={fieldClass}>
              <FieldLabel required>{s.meetings.dayEnds}</FieldLabel>
              <input
                {...fieldProps("ends_at", state)}
                className={inputClass}
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
          </div>
          <details
            className="rounded-md border border-[var(--border)] p-3"
            open={Boolean(
              stateValue(state, "advance_starts_at", meeting?.advance_starts_at) ||
                state.fieldErrors?.advance_starts_at ||
                state.fieldErrors?.advance_ends_at,
            )}
          >
            <summary className="tap-target cursor-pointer text-sm font-medium">{s.meetings.advance}</summary>
            <p className="mt-2 text-xs text-[var(--muted)]">{s.meetings.advanceHelp}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={fieldClass}>
                {s.meetings.advanceStarts}
                <input
                  {...fieldProps("advance_starts_at", state)}
                  className={inputClass}
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
              <label className={fieldClass}>
                {s.meetings.advanceEnds}
                <input
                  {...fieldProps("advance_ends_at", state)}
                  className={inputClass}
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
          </details>
        </fieldset>

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.meetings.sectionApproval}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.quorumRule}</FieldLabel>
            <select
              {...fieldProps("quorum_rule", state)}
              className={inputClass}
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
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.approvalsNeeded}</FieldLabel>
            <input
              {...fieldProps("required_approvals", state)}
              className={inputClass}
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
        </fieldset>
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
