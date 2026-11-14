"use client";

/**
 * "Cancel" for a form folded inside a <details>: clears what was typed and
 * folds the form away again.
 */
export function CloseDetailsButton({ className, label }: { className: string; label: string }) {
  return (
    <button
      className={className}
      onClick={(event) => {
        event.currentTarget.form?.reset();
        const details = event.currentTarget.closest("details");

        if (details) {
          details.open = false;
        }
      }}
      type="button"
    >
      {label}
    </button>
  );
}
