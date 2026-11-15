"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text people typed (reasons, notes, answers; up to 500 characters) shown
 * the same way everywhere (review 2026-11-15):
 * - an optional small label on its own line ("Reason"), not "Reason: ..." inline;
 * - line breaks kept, and long unbroken strings wrap instead of running off
 *   the screen;
 * - folded to a few lines, with "Show all" / "Show less" only when the text
 *   is longer than that.
 */
export function LongText({
  text,
  label,
  lines = 3,
  more,
  less,
  className = "",
}: {
  text: string;
  label?: string;
  lines?: 2 | 3 | 4;
  more: string;
  less: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measured in the browser: only folded text that does not fit gets a button.
  useEffect(() => {
    const element = ref.current;

    if (element && !open) {
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    }
  }, [text, open]);

  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" }[lines];

  return (
    <div className={`min-w-0 ${className}`}>
      {label ? <div className="text-xs text-[var(--muted)]">{label}</div> : null}
      <p
        className={`whitespace-pre-line [overflow-wrap:anywhere] ${open ? "" : clamp}`}
        ref={ref}
      >
        {text}
      </p>
      {overflows || open ? (
        <button
          aria-expanded={open}
          className="tap-target mt-0.5 text-xs font-medium text-[var(--primary)] underline"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? less : more}
        </button>
      ) : null}
    </div>
  );
}
