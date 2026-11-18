"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A text box with a length limit and a live counter ("120/500"), for the
 * reasons and notes on the Committee page (review 2026-11-14). The
 * database checks the same limits (migration 0035).
 */
export function CountedText({
  className,
  defaultValue = "",
  disabled = false,
  form,
  maxLength,
  multiline = false,
  name,
  required = false,
  rows = 2,
}: {
  className: string;
  /** Text already saved, for example the voter's earlier comment. */
  defaultValue?: string;
  disabled?: boolean;
  /** Id of the form this field belongs to, when it sits outside it. */
  form?: string;
  maxLength: number;
  multiline?: boolean;
  name: string;
  required?: boolean;
  rows?: number;
}) {
  const [length, setLength] = useState(defaultValue.length);
  const counterId = useId();
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // "Cancel" resets the form; the counter goes back to 0 with it.
  useEffect(() => {
    const form = fieldRef.current?.form;
    const reset = () => setLength(fieldRef.current?.defaultValue.length ?? 0);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const near = length >= maxLength * 0.9;
  const shared = {
    "aria-describedby": counterId,
    className,
    defaultValue,
    disabled,
    form,
    maxLength,
    name,
    onChange: (event: { currentTarget: { value: string } }) => setLength(event.currentTarget.value.length),
    ref: fieldRef,
    required,
  };

  return (
    <>
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />}
      <span
        aria-live="polite"
        className={`justify-self-end text-xs tabular-nums ${near ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}
        id={counterId}
      >
        {length}/{maxLength}
      </span>
    </>
  );
}
