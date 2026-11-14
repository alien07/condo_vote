"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RequiredMark } from "@/features/admin/components/field-label";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO time -> "YYYY-MM-DDTHH:mm" in Bangkok time, for datetime-local. */
function bangkokLocal(iso: string | number) {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * "When to close" in a close-early request. The close time can be typed
 * only after choosing "At this time", and must fall between now and the
 * normal end time (the database checks the same rule).
 */
export function CloseWhenFields({
  endsAt,
  inputClassName,
  labels,
}: {
  endsAt: string;
  inputClassName: string;
  labels: { when: string; now: string; at: string; atTime: string; atHint: string };
}) {
  const [when, setWhen] = useState<"now" | "at">("now");
  // Set when "At this time" is chosen, so the server and the browser render
  // the same page first.
  const [minimum, setMinimum] = useState<string | undefined>(undefined);
  const timed = when === "at";
  const hintId = useId();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  // "Cancel" resets the form: back to "As soon as approved".
  useEffect(() => {
    const form = fieldsetRef.current?.form;
    const reset = () => setWhen("now");
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  function choose(value: "now" | "at") {
    setWhen(value);

    if (value === "at") {
      setMinimum(bangkokLocal(Date.now()));
    }
  }

  return (
    <fieldset className="grid gap-2" ref={fieldsetRef}>
      <legend className="font-medium">{labels.when}</legend>
      <label className="inline-flex items-center gap-2">
        <input checked={!timed} name="when" onChange={() => choose("now")} type="radio" value="now" />
        {labels.now}
      </label>
      <label className="inline-flex items-center gap-2">
        <input checked={timed} name="when" onChange={() => choose("at")} type="radio" value="at" />
        {labels.at}
      </label>
      <label className={`grid gap-1 ${timed ? "" : "opacity-50"}`}>
        <span>
          {labels.atTime} {timed ? <RequiredMark /> : null}
        </span>
        <input
          aria-describedby={hintId}
          className={inputClassName}
          disabled={!timed}
          max={bangkokLocal(endsAt)}
          min={minimum}
          name="close_at"
          required={timed}
          type="datetime-local"
        />
        <span className="text-xs text-[var(--muted)]" id={hintId}>
          {labels.atHint}
        </span>
      </label>
    </fieldset>
  );
}
