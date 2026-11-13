"use client";

import { useStaffText } from "@/lib/i18n/staff/client";

import type { ComponentProps } from "react";
import { ConfirmButton } from "@/features/ui/confirm-button";

type ConfirmSubmitButtonProps = Omit<
  ComponentProps<typeof ConfirmButton>,
  "confirmTitle" | "confirmLabel" | "cancelLabel"
> & {
  /** Heading of the dialog; defaults to "Please confirm". */
  confirmTitle?: string;
  /** Label of the confirm button; defaults to "Confirm". */
  confirmLabel?: string;
};

/** ConfirmButton with the staff words (staff pages only). */
export function ConfirmSubmitButton({ confirmTitle, confirmLabel, ...props }: ConfirmSubmitButtonProps) {
  const { s } = useStaffText();

  return (
    <ConfirmButton
      {...props}
      cancelLabel={s.common.cancel}
      confirmLabel={confirmLabel ?? s.common.confirm}
      confirmTitle={confirmTitle ?? s.common.confirmTitle}
    />
  );
}

type FormResetButtonProps = {
  label: "Clear form" | "Reset changes";
};

export function FormResetButton({ label }: FormResetButtonProps) {
  const { s } = useStaffText();

  return (
    <button
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
      type="reset"
    >
      {label === "Clear form" ? s.common.clearForm : s.common.resetChanges}
    </button>
  );
}
