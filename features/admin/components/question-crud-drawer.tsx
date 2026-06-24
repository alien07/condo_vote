"use client";

import { useActionState, useEffect, useRef } from "react";
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
  required: boolean;
  required_threshold: string;
  requires_land_office_registration: boolean;
  resolution_type: string;
};

type QuestionCrudDrawerProps = {
  closeHref: string;
  meetings: MeetingOption[];
  mode: "create" | "edit";
  question?: QuestionRecord;
};

const emptyState: QuestionActionState = {};

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
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
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
  meetings,
  mode,
  question,
}: QuestionCrudDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    mode === "edit"
      ? updateMeetingQuestionWithState
      : createMeetingQuestionWithState,
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
          ? [`Question: ${question.question_text}`]
          : ["New agenda question"]
      }
      title={mode === "edit" ? "Edit question" : "Add question"}
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
        {mode === "edit" && question ? (
          <input name="id" type="hidden" value={question.id} />
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Meeting</FieldLabel>
          <select
            {...fieldProps("meeting_id", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "meeting_id", question?.meeting_id)}
            name="meeting_id"
          >
            <option value="">Select meeting</option>
            {meetings
              .filter(
                (meeting) =>
                  meeting.status !== "archived" ||
                  meeting.id === question?.meeting_id,
              )
              .map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title}
                </option>
              ))}
          </select>
          <FieldError fieldName="meeting_id" state={state} />
        </label>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "agenda_no", question?.agenda_no)}
          name="agenda_no"
          placeholder="Agenda no."
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "agenda_title",
            question?.agenda_title,
          )}
          name="agenda_title"
          placeholder="Agenda title"
        />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Question</FieldLabel>
          <input
            {...fieldProps("question_text", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "question_text",
              question?.question_text,
            )}
            name="question_text"
          />
          <FieldError fieldName="question_text" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Question type</FieldLabel>
          <select
            {...fieldProps("question_type", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "question_type",
              question?.question_type ?? "single_choice",
            )}
            name="question_type"
          >
            <option value="single_choice">Single choice</option>
            <option value="multiple_choice">Multiple choice</option>
          </select>
          <FieldError fieldName="question_type" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Resolution type</FieldLabel>
          <select
            {...fieldProps("resolution_type", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "resolution_type",
              question?.resolution_type ?? "ordinary",
            )}
            name="resolution_type"
          >
            <option value="ordinary">Ordinary</option>
            <option value="special">Special</option>
            <option value="informational">Informational</option>
          </select>
          <FieldError fieldName="resolution_type" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Required threshold</FieldLabel>
          <select
            {...fieldProps("required_threshold", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "required_threshold",
              question?.required_threshold ?? "majority_submitted",
            )}
            name="required_threshold"
          >
            <option value="majority_submitted">Majority submitted</option>
            <option value="one_third_total">1/3 total ownership</option>
            <option value="half_total">1/2 total ownership</option>
            <option value="three_fourths_total">3/4 total ownership</option>
            <option value="informational">Informational</option>
          </select>
          <FieldError fieldName="required_threshold" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Order
          <input
            {...fieldProps("display_order", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "display_order",
              question?.display_order ?? 0,
            )}
            min={0}
            name="display_order"
            type="number"
          />
          <FieldError fieldName="display_order" state={state} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            defaultChecked={checkedValue(
              state,
              "required",
              question?.required ?? true,
            )}
            name="required"
            type="checkbox"
          />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            defaultChecked={checkedValue(
              state,
              "requires_land_office_registration",
              question?.requires_land_office_registration ?? false,
            )}
            name="requires_land_office_registration"
            type="checkbox"
          />
          Land office registration
        </label>
        <textarea
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "legal_note", question?.legal_note)}
          name="legal_note"
          placeholder="Legal / admin note"
          rows={2}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={mode === "edit" ? "Saving..." : "Adding..."}
            type="submit"
          >
            {mode === "edit" ? "Save question" : "Add question"}
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
