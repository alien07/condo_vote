"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { questionIsAnswered, setQuestionError } from "@/features/voting/components/ballot-form";
import { applyChoiceLimits, syncAllChoiceLimits } from "@/features/voting/components/choice-limits";

/**
 * The ballot as an owner sees it, for the admin to try (2026-11-18): pick,
 * type and submit like an owner, with the same required-answer checks, but
 * nothing is sent or saved.
 */
export function BallotPreviewForm({
  children,
  doneText,
  resetLabel,
  submitLabel,
}: {
  children: ReactNode;
  doneText: string;
  resetLabel: string;
  submitLabel: string;
}) {
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A preview never submits.
    event.preventDefault();
    let firstMissing: HTMLFieldSetElement | null = null;

    event.currentTarget
      .querySelectorAll<HTMLFieldSetElement>('fieldset[data-required="true"]')
      .forEach((fieldset) => {
        const missing = !questionIsAnswered(fieldset);

        setQuestionError(fieldset, missing);
        firstMissing ??= missing ? fieldset : null;
      });

    if (firstMissing) {
      setDone(false);
      (firstMissing as HTMLFieldSetElement).scrollIntoView({ behavior: "smooth", block: "start" });
      (firstMissing as HTMLFieldSetElement)
        .querySelector<HTMLInputElement>("input:not([disabled])")
        ?.focus({ preventScroll: true });
      return;
    }

    setDone(true);
  }

  return (
    <form
      className="grid gap-5"
      data-ballot-preview
      noValidate
      onChange={(event) => {
        // The same choice rules as the real ballot.
        applyChoiceLimits(event.target);
        const fieldset = (event.target as HTMLElement).closest("fieldset");

        setDone(false);

        if (fieldset && questionIsAnswered(fieldset)) {
          setQuestionError(fieldset, false);
        }
      }}
      onReset={(event) => {
        const form = event.currentTarget;

        setDone(false);
        form.querySelectorAll("fieldset").forEach((fieldset) => setQuestionError(fieldset, false));
        // The boxes are cleared after this event; unlock them then.
        window.setTimeout(() => syncAllChoiceLimits(form), 0);
      }}
      onSubmit={onSubmit}
    >
      {children}
      {done ? (
        <p
          className="rounded-md border border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-sm font-medium"
          data-preview-done
          role="status"
        >
          {doneText}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          type="submit"
        >
          {submitLabel}
        </button>
        <button
          className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          type="reset"
        >
          {resetLabel}
        </button>
      </div>
    </form>
  );
}
