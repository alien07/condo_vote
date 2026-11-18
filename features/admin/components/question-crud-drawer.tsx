"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createMeetingQuestionWithState,
  updateMeetingQuestionWithState,
  type QuestionActionState,
} from "@/features/admin/actions";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { SearchSelect, invalidFieldElement } from "@/features/ui/search-select";

type MeetingOption = {
  id: string;
  status: string;
  title: string;
};

type QuestionRecord = {
  agenda_no: string | null;
  agenda_title: string | null;
  display_order: number;
  id: string;
  legal_note: string | null;
  meeting_id: string;
  question_text: string;
  question_type: string;
  max_choices?: number | null;
  required: boolean;
  required_threshold: string;
  pass_basis?: string;
  pass_operator?: string;
  pass_percent?: number | string;
  requires_land_office_registration: boolean;
  resolution_type: string;
  allow_comment?: boolean | null;
  meeting_choices?: { is_abstain?: boolean | null }[];
};

type QuestionCrudDrawerProps = {
  closeHref: string;
  /** The meeting picked on the Agenda tab, for a new agenda item. */
  defaultMeetingId?: string;
  meetings: MeetingOption[];
  mode: "create" | "edit";
  question?: QuestionRecord;
};

const emptyState: QuestionActionState = {};

const groupClass = "grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-4";
const legendClass = "px-1 text-sm font-semibold";
const fieldClass = "grid min-w-0 gap-1 text-sm font-medium";
const inputClass = "min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";

function fieldErrorId(fieldName: string) {
  return `question-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: QuestionActionState) {
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
  state: QuestionActionState;
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
  state: QuestionActionState,
  fieldName: string,
  fallback: number | string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function checkedValue(
  state: QuestionActionState,
  fieldName: string,
  fallback: boolean,
) {
  return state.values
    ? state.values[fieldName] === "on"
    : fallback;
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function QuestionRowFocus({ questionId }: { questionId?: string | null }) {
  useEffect(() => {
    if (!questionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const selector = `[data-question-id="${escapeSelectorValue(questionId)}"]`;
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
  }, [questionId]);

  return null;
}

export function QuestionCrudDrawer({
  closeHref,
  defaultMeetingId,
  meetings,
  mode,
  question,
}: QuestionCrudDrawerProps) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    mode === "edit"
      ? updateMeetingQuestionWithState
      : createMeetingQuestionWithState,
    emptyState,
  );
  // Show a field only when it applies (2026-11-18 review).
  const [questionType, setQuestionType] = useState(
    stateValue(state, "question_type", question?.question_type ?? "single_choice"),
  );
  const [threshold, setThreshold] = useState(
    stateValue(state, "required_threshold", question?.required_threshold ?? "majority_submitted"),
  );
  // Agenda items can only be added to a draft meeting (0039). An item being
  // edited, or a new one opened from a draft meeting's agenda, stays with
  // that meeting; otherwise pick one of the draft meetings.
  const fixedMeeting = meetings.find(
    (meeting) =>
      meeting.id === (question?.meeting_id ?? defaultMeetingId) &&
      (mode === "edit" || meeting.status === "draft"),
  );
  const draftOptions = meetings
    .filter((meeting) => meeting.status === "draft")
    .map((meeting) => ({ value: meeting.id, label: meeting.title }));

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const element = invalidFieldElement(formRef.current, firstInvalidField);

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
    params.set("tab", "questions");
    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusQuestionId", state.recordId);
    window.location.assign(`/admin/meetings?${params.toString()}`);
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={
        mode === "edit" && question
          ? [fill(s.meetings.questionSummary, { text: question.question_text })]
          : [s.meetings.newQuestion]
      }
      title={mode === "edit" ? s.meetings.editQuestion : s.meetings.addQuestion}
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
        {mode === "edit" && question ? (
          <input name="id" type="hidden" value={question.id} />
        ) : null}
        {/* The agenda belongs to one draft meeting (2026-11-18 review). */}
        {fixedMeeting ? (
          <div className="grid gap-1 text-sm" data-fixed-meeting>
            <span className="font-medium">{s.meetings.meeting}</span>
            <span className="rounded-md bg-[var(--background)] px-3 py-2">{fixedMeeting.title}</span>
            <input name="meeting_id" type="hidden" value={fixedMeeting.id} />
          </div>
        ) : (
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.meeting}</FieldLabel>
            {draftOptions.length ? (
              <SearchSelect
                {...fieldProps("meeting_id", state)}
                autoFocus
                defaultValue={stateValue(state, "meeting_id")}
                name="meeting_id"
                options={draftOptions}
                text={{
                  clear: s.common.searchClear,
                  more: s.common.searchMore,
                  noResults: s.common.searchNoResults,
                  placeholder: s.meetings.agendaPickMeeting,
                }}
              />
            ) : (
              <span className="text-sm font-normal text-[var(--muted)]">{s.meetings.noDraftMeetings}</span>
            )}
            <FieldError fieldName="meeting_id" state={state} />
          </label>
        )}

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.meetings.sectionAgenda}</legend>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <label className={fieldClass}>
              {s.meetings.agendaNo}
              <input
                autoFocus={Boolean(fixedMeeting)}
                className={inputClass}
                defaultValue={stateValue(state, "agenda_no", question?.agenda_no)}
                name="agenda_no"
                placeholder={s.meetings.agendaNoHint}
              />
            </label>
            <label className={fieldClass}>
              {s.meetings.agendaTitle}
              <input
                className={inputClass}
                defaultValue={stateValue(state, "agenda_title", question?.agenda_title)}
                name="agenda_title"
              />
            </label>
          </div>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.question}</FieldLabel>
            <input
              {...fieldProps("question_text", state)}
              className={inputClass}
              defaultValue={stateValue(state, "question_text", question?.question_text)}
              name="question_text"
            />
            <FieldError fieldName="question_text" state={state} />
          </label>
        </fieldset>

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.meetings.sectionResolution}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.questionType}</FieldLabel>
            <select
              {...fieldProps("question_type", state)}
              className={inputClass}
              name="question_type"
              onChange={(event) => setQuestionType(event.target.value)}
              value={questionType}
            >
              <option value="single_choice">{s.meetings.single}</option>
              <option value="multiple_choice">{s.meetings.multiple}</option>
            </select>
            <FieldError fieldName="question_type" state={state} />
          </label>
          {/* Only for multiple choice. */}
          {questionType === "multiple_choice" ? (
            <label className={fieldClass}>
              {s.meetings.maxChoices}
              <input
                {...fieldProps("max_choices", state)}
                className={inputClass}
                defaultValue={stateValue(state, "max_choices", question?.max_choices ?? "")}
                min={1}
                name="max_choices"
                placeholder={s.meetings.noLimit}
                type="number"
              />
              <FieldError fieldName="max_choices" state={state} />
            </label>
          ) : null}
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.resolutionType}</FieldLabel>
            <select
              {...fieldProps("resolution_type", state)}
              className={inputClass}
              defaultValue={stateValue(state, "resolution_type", question?.resolution_type ?? "ordinary")}
              name="resolution_type"
            >
              <option value="ordinary">{s.meetings.ordinary}</option>
              <option value="special">{s.meetings.special}</option>
              <option value="informational">{s.meetings.informational}</option>
            </select>
            <FieldError fieldName="resolution_type" state={state} />
          </label>
          <label className={fieldClass}>
            <FieldLabel required>{s.meetings.passRule}</FieldLabel>
            <select
              {...fieldProps("required_threshold", state)}
              className={inputClass}
              name="required_threshold"
              onChange={(event) => setThreshold(event.target.value)}
              value={threshold}
            >
              <option value="majority_submitted">{s.meetings.ruleVotingMajority}</option>
              <option value="half_total">{s.meetings.ruleTotalMajority}</option>
              <option value="one_third_total">{s.meetings.ruleThird}</option>
              <option value="three_fourths_total">{s.meetings.ruleThreeQuarters}</option>
              <option value="informational">{s.meetings.ruleInfo}</option>
              <option value="custom">{s.meetings.ruleCustom}</option>
            </select>
            <FieldError fieldName="required_threshold" state={state} />
          </label>
          {/* Only for a custom pass rule. */}
          {threshold === "custom" ? (
            <div className="grid gap-2 rounded-md bg-[var(--background)] p-3 text-sm" data-custom-rule>
              <p className="text-xs text-[var(--muted)]">{s.meetings.customHelp}</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem]">
                <label className={fieldClass}>
                  {s.meetings.basis}
                  <select
                    {...fieldProps("pass_basis", state)}
                    className={inputClass}
                    defaultValue={stateValue(state, "pass_basis", question?.pass_basis ?? "voting_ownership")}
                    name="pass_basis"
                  >
                    <option value="voting_ownership">{s.meetings.basisVoting}</option>
                    <option value="total_ownership">{s.meetings.basisTotal}</option>
                  </select>
                </label>
                <label className={fieldClass}>
                  {s.meetings.comparison}
                  <select
                    {...fieldProps("pass_operator", state)}
                    className={inputClass}
                    defaultValue={stateValue(state, "pass_operator", question?.pass_operator ?? "gt")}
                    name="pass_operator"
                  >
                    <option value="gt">{s.meetings.moreThan}</option>
                    <option value="gte">{s.meetings.atLeast}</option>
                  </select>
                </label>
                <label className={fieldClass}>
                  {s.meetings.percent}
                  <input
                    {...fieldProps("pass_percent", state)}
                    className={inputClass}
                    defaultValue={stateValue(state, "pass_percent", question?.pass_percent ?? 50)}
                    max={100}
                    min={0}
                    name="pass_percent"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
              <FieldError fieldName="pass_basis" state={state} />
              <FieldError fieldName="pass_operator" state={state} />
              <FieldError fieldName="pass_percent" state={state} />
            </div>
          ) : null}
          {/* Abstain only when the item needs it; its text is fixed (0041). */}
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input
              className="mt-1"
              defaultChecked={checkedValue(
                state,
                "has_abstain",
                Boolean(question?.meeting_choices?.some((choice) => choice.is_abstain)),
              )}
              name="has_abstain"
              type="checkbox"
            />
            <span>
              {s.meetings.hasAbstain}
              <span className="block text-xs text-[var(--muted)]">{s.meetings.hasAbstainHelp}</span>
            </span>
          </label>
          {/* Voters may add a comment of up to 500 characters (2026-11-18). */}
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input
              className="mt-1"
              defaultChecked={checkedValue(state, "allow_comment", question?.allow_comment ?? false)}
              name="allow_comment"
              type="checkbox"
            />
            <span>
              {s.meetings.allowComment}
              <span className="block text-xs text-[var(--muted)]">{s.meetings.allowCommentHelp}</span>
            </span>
          </label>
        </fieldset>

        <details
          className="rounded-lg border border-[var(--border)] p-4"
          open={Boolean(state.fieldErrors?.display_order)}
        >
          <summary className="tap-target cursor-pointer text-sm font-semibold">{s.meetings.moreSettings}</summary>
          <div className="mt-3 grid gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                defaultChecked={checkedValue(state, "required", question?.required ?? true)}
                name="required"
                type="checkbox"
              />
              {s.meetings.required}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                defaultChecked={checkedValue(
                  state,
                  "requires_land_office_registration",
                  question?.requires_land_office_registration ?? false,
                )}
                name="requires_land_office_registration"
                type="checkbox"
              />
              {s.meetings.landOfficeField}
            </label>
            <label className={fieldClass}>
              {s.meetings.legalNote}
              <textarea
                className={inputClass}
                defaultValue={stateValue(state, "legal_note", question?.legal_note)}
                name="legal_note"
                rows={2}
              />
            </label>
            <label className={fieldClass}>
              {s.meetings.order}
              <input
                {...fieldProps("display_order", state)}
                className={inputClass}
                defaultValue={stateValue(
                  state,
                  "display_order",
                  question ? Math.max(1, question.display_order) : "",
                )}
                min={1}
                name="display_order"
                type="number"
              />
              <span className="text-xs font-normal text-[var(--muted)]">{s.meetings.orderHelp}</span>
              <FieldError fieldName="display_order" state={state} />
            </label>
          </div>
        </details>
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={mode === "edit" ? s.common.saving : s.meetings.adding}
            type="submit"
          >
            {mode === "edit" ? s.meetings.saveQuestion : s.meetings.addQuestion}
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
