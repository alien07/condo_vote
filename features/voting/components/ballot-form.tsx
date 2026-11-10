"use client";

import type { FormEvent, ReactNode } from "react";

// Checks required questions before submitting and shows the message under the
// question itself. The browser's own bubble pointed at questions hidden under
// the header on phones. The voting core service still validates on the server.
function questionIsAnswered(fieldset: Element) {
  return Boolean(fieldset.querySelector("input:checked"));
}

function setQuestionError(fieldset: Element, invalid: boolean) {
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

  return (
    <form
      action={action}
      className={className}
      noValidate
      onChange={(event) => {
        const fieldset = (event.target as HTMLElement).closest("fieldset");

        if (fieldset && questionIsAnswered(fieldset)) {
          setQuestionError(fieldset, false);
        }
      }}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}
