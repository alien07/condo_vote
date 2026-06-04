"use client";

import type { ComponentProps } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type ConfirmSubmitButtonProps = ComponentProps<"button"> & {
  confirmMessage: string;
  debugName?: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  pendingLabel,
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <PendingSubmitButton
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      pendingLabel={pendingLabel}
      type={props.type ?? "submit"}
    />
  );
}

type FormResetButtonProps = {
  label: "Clear form" | "Reset changes";
};

export function FormResetButton({ label }: FormResetButtonProps) {
  return (
    <button
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
      type="reset"
    >
      {label}
    </button>
  );
}
