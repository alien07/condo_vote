"use client";

import { TrackedSubmitButton } from "@/features/debug/tracked-submit-button";

type GoogleLoginFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  next: string;
  pendingLabel: string;
};

export function GoogleLoginForm({
  action,
  label,
  next,
  pendingLabel,
}: GoogleLoginFormProps) {
  return (
    <form
      action={action}
      className="mt-5"
      onSubmit={() => {
        console.debug(`[condoVotes:debug] ${JSON.stringify({
          event: "ui.submit",
          name: "login.google",
          next,
          path: window.location.pathname,
        })}`);
      }}
    >
      <input name="next" type="hidden" value={next} />
      <TrackedSubmitButton
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
        debugName="login.google"
        pendingLabel={pendingLabel}
      >
        {label}
      </TrackedSubmitButton>
    </form>
  );
}
