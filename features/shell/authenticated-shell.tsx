import type { ReactNode } from "react";
import { Building2, LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { TrackedSubmitButton } from "@/features/debug/tracked-submit-button";
import { AppFeedbackBanner } from "@/features/shell/app-feedback-banner";
import { AppShellNav } from "@/features/shell/app-shell-nav";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";
import { requireProfileWithRoles } from "@/lib/auth/permissions";

type AuthenticatedShellProps = {
  children: ReactNode;
};

export async function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const { profile, roles } = await requireProfileWithRoles();
  const isAdmin = roles.includes("admin");
  const roleLabel = roles.length > 0 ? roles.join(", ") : "user";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{APP_NAME}</div>
              <div className="text-xs text-[var(--muted)]">v{APP_VERSION}</div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center">
            <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:max-w-72">
              <div className="truncate font-medium">{profile.full_name}</div>
              <div className="truncate text-xs text-[var(--muted)]">
                {profile.email} / {profile.default_status} / {roleLabel}
              </div>
            </div>
            <form action={signOut}>
              <TrackedSubmitButton
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium md:w-auto"
                debugName="auth.logout"
                pendingLabel="Signing out..."
                type="submit"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </TrackedSubmitButton>
            </form>
          </div>
        </div>
        <AppShellNav isAdmin={isAdmin} />
      </header>
      <AppFeedbackBanner />
      {children}
    </>
  );
}
