"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type ConfirmButtonProps = ComponentProps<"button"> & {
  confirmMessage: string;
  confirmTitle: string;
  confirmLabel: string;
  cancelLabel: string;
  /** "danger" (red) for actions that cannot be undone, the default. */
  tone?: "danger" | "primary";
  debugName?: string;
  pendingLabel?: string;
};

// Asks before submitting, in the app's own dialog (demo feedback item 13).
// Owner pages pass their own words; staff pages use ConfirmSubmitButton.
// The browser's confirm() showed "localhost:3000 says" in browser colours.
// A modal <dialog> keeps focus inside and closes on Esc (cancel).
export function ConfirmButton({
  confirmMessage,
  confirmTitle,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onClick,
  pendingLabel,
  ...props
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);
  const titleId = useId();
  const messageId = useId();
  // The dialog's words exist only while it is open, so a closed dialog adds
  // no hidden copy of the message to the page.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [open]);

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
          setOpen(true);
        }}
        pendingLabel={pendingLabel}
        ref={buttonRef}
        type={props.type ?? "submit"}
      />
      <dialog
        aria-describedby={messageId}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/40"
        onClose={() => setOpen(false)}
        ref={dialogRef}
        role="alertdialog"
      >
        {open ? (
        <div className="grid gap-3 p-5">
          <h2 className="text-lg font-semibold" id={titleId}>
            {confirmTitle}
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
              {cancelLabel}
            </button>
            <button
              className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium text-white ${
                tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--primary)]"
              }`}
              onClick={confirmAndSubmit}
              type="button"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
        ) : null}
      </dialog>
    </>
  );
}
