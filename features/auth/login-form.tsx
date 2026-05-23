"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { signInWithEmail, type LoginState } from "@/features/auth/actions";

const initialState: LoginState = {};

export function EmailLoginForm() {
  const [state, formAction, pending] = useActionState(
    signInWithEmail,
    initialState,
  );

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        id="email"
        name="email"
        placeholder="owner@example.com"
        type="email"
      />
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <Mail size={16} aria-hidden="true" />
        {pending ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}
