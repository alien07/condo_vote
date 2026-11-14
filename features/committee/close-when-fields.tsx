"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RequiredMark } from "@/features/admin/components/field-label";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO time -> "YYYY-MM-DDTHH:mm" in Bangkok time, for datetime-local. */
function bangkokLocal(iso: string) {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * "When to close" in a close-early request (review 2026-11-14, option b).
 * A request can be sent at any time, but voting can only close on the
 * meeting day: the close time must fall between the start of meeting-day
 * voting (or now, if later) and the normal end time, and "As soon as
 * approved" is offered only once meeting-day voting has started, so advance
 * voting can never end the meeting before its day. The database checks the
 * same rules.
 */
export function CloseWhenFields({
  endsAt,
  inputClassName,
  labels,
  meetingDayStarted,
  minAt,
}: {
  endsAt: string;
  inputClassName: string;
  labels: {
    when: string;
    now: string;
    nowLater: string;
    at: string;
    atTime: string;
    atHint: string;
  };
  /** Whether meeting-day voting has started ("As soon as approved" allowed). */
  meetingDayStarted: boolean;
  /** Earliest close time: the later of now and the start of meeting-day voting. */
  minAt: string;
}) {
  const initial = meetingDayStarted ? "now" : "at";
  const [when, setWhen] = useState<"now" | "at">(initial);
  const timed = when === "at";
  const hintId = useId();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  // "Cancel" resets the form: back to the first choice.
  useEffect(() => {
    const form = fieldsetRef.current?.form;
    const reset = () => setWhen(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);

  return (
    <fieldset className="grid gap-2" ref={fieldsetRef}>
      <legend className="font-medium">{labels.when}</legend>
      <label className={`inline-flex items-center gap-2 ${meetingDayStarted ? "" : "opacity-50"}`}>
        <input
          checked={!timed}
          disabled={!meetingDayStarted}
          name="when"
          onChange={() => setWhen("now")}
          type="radio"
          value="now"
        />
        {labels.now}
      </label>
      {meetingDayStarted ? null : (
        <span className="-mt-1 ml-6 text-xs text-[var(--muted)]">{labels.nowLater}</span>
      )}
      <label className="inline-flex items-center gap-2">
        <input checked={timed} name="when" onChange={() => setWhen("at")} type="radio" value="at" />
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
          min={bangkokLocal(minAt)}
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
