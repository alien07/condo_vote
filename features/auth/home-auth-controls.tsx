"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { TrackedLink } from "@/features/debug/tracked-link";
import { TrackedSubmitButton } from "@/features/debug/tracked-submit-button";

type HomeAuthState = {
  profile: {
    default_status: string;
    email: string;
    full_name: string;
  };
  roles: string[];
};

type HomeAuthControlsProps = {
  initialCurrent: HomeAuthState | null;
};

export function HomeAuthControls({ initialCurrent }: HomeAuthControlsProps) {
  const [current, setCurrent] = useState(initialCurrent);

  useEffect(() => {
    async function requestCurrentUser() {
      const response = await fetch("/auth/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Auth status request failed.");
      }

      return (await response.json()) as HomeAuthState | null;
    }

    async function syncCurrentUser() {
      try {
        const currentUser = await requestCurrentUser();

        if (currentUser) {
          setCurrent(currentUser);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        setCurrent(await requestCurrentUser());
      } catch {
        console.debug(
          `[condoVotes:debug] ${JSON.stringify({
            event: "home.auth_sync.failed",
          })}`,
        );
      }
    }

    void syncCurrentUser();
  }, []);

  if (!current) {
    return (
      <TrackedLink
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-medium"
        debugName="home.login"
        href="/login"
      >
        Sign in
      </TrackedLink>
    );
  }

  const roleLabel = current.roles.length > 0 ? current.roles.join(", ") : "user";

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center">
      <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div className="truncate font-medium">{current.profile.full_name}</div>
        <div className="truncate text-xs text-[var(--muted)]">
          {current.profile.email} / {current.profile.default_status} / {roleLabel}
        </div>
      </div>
      <form action={signOut}>
        <TrackedSubmitButton
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium sm:w-auto"
          debugName="home.logout"
          pendingLabel="Signing out..."
          type="submit"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </TrackedSubmitButton>
      </form>
    </div>
  );
}
