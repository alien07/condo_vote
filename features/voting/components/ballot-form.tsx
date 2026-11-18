"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { applyChoiceLimits, syncAllChoiceLimits } from "@/features/voting/components/choice-limits";

// Checks required questions before submitting and shows the message under the
// question itself. The browser's own bubble pointed at questions hidden under
// the header on phones. The voting core service still validates on the server.
export function questionIsAnswered(fieldset: Element) {
  return Boolean(fieldset.querySelector("input:checked"));
}

export function setQuestionError(fieldset: Element, invalid: boolean) {
  const message = fieldset.querySelector<HTMLElement>("[data-question-error]");

  if (message) {
    message.hidden = !invalid;
  }

  fieldset.setAttribute("aria-invalid", invalid ? "true" : "false");
}

export function BallotForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    let firstMissing: HTMLFieldSetElement | null = null;

    event.currentTarget
      .querySelectorAll<HTMLFieldSetElement>('fieldset[data-required="true"]')
      .forEach((fieldset) => {
        const missing = !questionIsAnswered(fieldset);

        setQuestionError(fieldset, missing);
        firstMissing ??= missing ? fieldset : null;
      });

    if (firstMissing) {
      event.preventDefault();
      (firstMissing as HTMLFieldSetElement).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      (firstMissing as HTMLFieldSetElement)
        .querySelector<HTMLInputElement>("input:not([disabled])")
        ?.focus({ preventScroll: true });
    }
  }

  const formRef = useRef<HTMLFormElement>(null);

  // A saved ballot may already be at the limit.
  useEffect(() => {
    if (formRef.current) {
      syncAllChoiceLimits(formRef.current);
    }
  }, []);

  return (
    <form
      action={action}
      className={className}
      noValidate
      onChange={(event) => {
        applyChoiceLimits(event.target);
        const fieldset = (event.target as HTMLElement).closest("fieldset");

        if (fieldset && questionIsAnswered(fieldset)) {
          setQuestionError(fieldset, false);
        }
      }}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {children}
    </form>
  );
}
