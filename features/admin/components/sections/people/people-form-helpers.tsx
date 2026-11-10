"use client";

import { useMessageText } from "@/lib/i18n/staff/client";
import type { PeopleActionState } from "@/features/admin/action-modules/people";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const emptyState: PeopleActionState = {};

export function fieldErrorId(fieldName: string) {
  return `people-${fieldName}-error`;
}

export function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: PeopleActionState;
}) {
  const tm = useMessageText();
  const message = state.fieldErrors?.[fieldName];

  if (!message) {
    return null;
  }

  return (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {tm(message)}
    </p>
  );
}

export function fieldProps(fieldName: string, state: PeopleActionState) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

export function stateValue(
  state: PeopleActionState,
  fieldName: string,
  fallback: number | string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

export function FormErrorSummary({ state }: { state: PeopleActionState }) {
  const tm = useMessageText();
  if (!state.error) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
      role="alert"
    >
      {tm(state.error)}
    </div>
  );
}

export function DrawerSubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function usePeopleFormFeedback(
  activeSection: "owners" | "profiles" | "rooms",
  state: PeopleActionState,
  formRef: React.RefObject<HTMLFormElement | null>,
  mode?: "create" | "edit",
) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const field = formRef.current?.elements.namedItem(firstInvalidField);
      const element =
        field instanceof RadioNodeList ? field[0] : field instanceof HTMLElement ? field : null;

      element?.focus();
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    if (state.success) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("mode");
      params.delete("type");
      params.delete("id");
      params.set("tab", activeSection);
      params.set("feedback", "success");
      params.set("message", state.success);

      if (activeSection !== "rooms" || mode === "create") {
        params.delete("page");
      }

      if (
        activeSection === "rooms" &&
        mode === "create" &&
        state.values?.room_number
      ) {
        params.set("room", state.values.room_number);
      }

      if (
        activeSection === "rooms" &&
        mode === "edit" &&
        state.values?.id
      ) {
        params.set("focusRoomId", state.values.id);
      }

      if (activeSection === "owners" && state.values?.full_name) {
        params.set("name", state.values.full_name);
      }

      const query = params.toString();

      window.location.assign(query ? `/admin/people?${query}` : "/admin/people");
    }
  }, [activeSection, formRef, mode, searchParams, state]);
}
