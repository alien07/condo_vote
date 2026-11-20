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

export type ActionRowToggle = {
  key: string;
  label: string;
  className: string;
  panel: ReactNode;
};

export function ActionRow({
  actions,
  more = [],
  panel,
  toggleClassName,
  toggleLabel,
  ...rest
}: {
  /** Buttons before the toggle, e.g. the approve form. */
  actions?: ReactNode;
  /** Further toggles after the first, each with its own form; one opens at a time. */
  more?: ActionRowToggle[];
  /** The form that opens below the row. */
  panel: ReactNode;
  toggleClassName: string;
  toggleLabel: string;
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggles: ActionRowToggle[] = [
    { key: "main", label: toggleLabel, className: toggleClassName, panel },
    ...more,
  ];

  function close() {
    panelRef.current?.querySelectorAll("form").forEach((form) => form.reset());
    setOpen(null);
  }

  return (
    <CloseContext.Provider value={close}>
      <div className="grid gap-3" {...rest}>
        <div className="flex flex-wrap items-start gap-2">
          {actions}
          {toggles.map((toggle) => (
            <button
              aria-controls={`${baseId}-${toggle.key}`}
              aria-expanded={open === toggle.key}
              className={`${toggle.className} ${open === toggle.key ? "bg-[var(--background)] ring-2 ring-[var(--border)]" : ""}`}
              key={toggle.key}
              onClick={() => (open === toggle.key ? close() : setOpen(toggle.key))}
              type="button"
            >
              {toggle.label}
            </button>
          ))}
        </div>
        {/* Kept in the page while folded, so a form keeps its state until Cancel. */}
        <div ref={panelRef}>
          {toggles.map((toggle) => (
            <div
              data-action-panel={toggle.key}
              hidden={open !== toggle.key}
              id={`${baseId}-${toggle.key}`}
              key={toggle.key}
            >
              {toggle.panel}
            </div>
          ))}
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
