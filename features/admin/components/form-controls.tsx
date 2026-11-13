"use client";

import { useStaffText } from "@/lib/i18n/staff/client";

import { useId, useRef, type ComponentProps } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type ConfirmSubmitButtonProps = ComponentProps<"button"> & {
  confirmMessage: string;
  /** Heading of the dialog; defaults to "Please confirm". */
  confirmTitle?: string;
  /** Label of the confirm button; defaults to "Confirm". */
  confirmLabel?: string;
  /** "danger" (red) for actions that cannot be undone, the default. */
  tone?: "danger" | "primary";
  debugName?: string;
  pendingLabel?: string;
};

// Asks before submitting, in the app's own dialog (demo feedback item 13).
// The browser's confirm() showed "localhost:3000 says" in browser colours.
// A modal <dialog> keeps focus inside and closes on Esc (cancel).
export function ConfirmSubmitButton({
  confirmMessage,
  confirmTitle,
  confirmLabel,
  tone = "danger",
  onClick,
  pendingLabel,
  ...props
}: ConfirmSubmitButtonProps) {
  const { s } = useStaffText();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);
  const titleId = useId();
  const messageId = useId();

  function confirmAndSubmit() {
    dialogRef.current?.close();
    const button = buttonRef.current;
    const form = button?.form;

    if (!button || !form) {
      return;
    }

    confirmedRef.current = true;
    // Submit as if the button was pressed, so its name and value are sent.
    form.requestSubmit(button);
    confirmedRef.current = false;
  }

  return (
    <>
      <PendingSubmitButton
        {...props}
        onClick={(event) => {
          onClick?.(event);

          if (event.defaultPrevented || confirmedRef.current) {
            return;
          }

          event.preventDefault();
          dialogRef.current?.showModal();
        }}
        pendingLabel={pendingLabel}
        ref={buttonRef}
        type={props.type ?? "submit"}
      />
      <dialog
        aria-describedby={messageId}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
        role="alertdialog"
      >
        <div className="grid gap-3 p-5">
          <h2 className="text-lg font-semibold" id={titleId}>
            {confirmTitle ?? s.common.confirmTitle}
          </h2>
          <p className="whitespace-pre-line text-sm" id={messageId}>
            {confirmMessage}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              autoFocus
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              {s.common.cancel}
            </button>
            <button
              className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium text-white ${
                tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--primary)]"
              }`}
              onClick={confirmAndSubmit}
              type="button"
            >
              {confirmLabel ?? s.common.confirm}
            </button>
          </div>
        </div>
      </dialog>
    </>
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
