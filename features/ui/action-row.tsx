"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";

/**
 * One row of action buttons where one of them opens a form below the row
 * (review 2026-11-15): "Approve" + "Object", "Approve result" + "Request a
 * correction". The buttons stay in their row while the form is open; the
 * toggle shows as pressed. The form ends with ActionRowCancel, which clears
 * it and folds it away.
 */
const CloseContext = createContext<() => void>(() => {});

export function ActionRow({
  actions,
  panel,
  toggleClassName,
  toggleLabel,
  ...rest
}: {
  /** Buttons before the toggle, e.g. the approve form. */
  actions?: ReactNode;
  /** The form that opens below the row. */
  panel: ReactNode;
  toggleClassName: string;
  toggleLabel: string;
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    panelRef.current?.querySelectorAll("form").forEach((form) => form.reset());
    setOpen(false);
  }

  return (
    <CloseContext.Provider value={close}>
      <div className="grid gap-3" {...rest}>
        <div className="flex flex-wrap items-start gap-2">
          {actions}
          <button
            aria-controls={panelId}
            aria-expanded={open}
            className={`${toggleClassName} ${open ? "bg-[var(--background)] ring-2 ring-[var(--border)]" : ""}`}
            onClick={() => (open ? close() : setOpen(true))}
            type="button"
          >
            {toggleLabel}
          </button>
        </div>
        {/* Kept in the page while folded, so the form keeps its state until Cancel. */}
        <div hidden={!open} id={panelId} ref={panelRef}>
          {panel}
        </div>
      </div>
    </CloseContext.Provider>
  );
}

/** "Cancel" at the end of an ActionRow form: clears it and folds it away. */
export function ActionRowCancel({ className, label }: { className: string; label: string }) {
  const close = useContext(CloseContext);

  return (
    <button className={className} onClick={close} type="button">
      {label}
    </button>
  );
}
