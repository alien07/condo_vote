import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { TrackedSubmitButton } from "@/features/debug/tracked-submit-button";
import { AppFeedbackBanner } from "@/features/shell/app-feedback-banner";
import { AppShellNav } from "@/features/shell/app-shell-nav";
import { ApprovalNotice } from "@/features/shell/approval-notice";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";
import { needsPrivacyConsent } from "@/features/privacy/service";
import { requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { HelpLink } from "@/features/help/help-link";
import { getI18n } from "@/lib/i18n/server";
import { getStaffDictionary } from "@/lib/i18n/staff";
import { StaffTextProvider } from "@/lib/i18n/staff/client";

type AuthenticatedShellProps = {
  children: ReactNode;
};

export async function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const { profile, roles } = await requireProfileWithRoles();

  // PDPA consent comes before any page that shows personal data (D016).
  if (await needsPrivacyConsent(await createClient())) {
    redirect("/consent");
  }

  const { locale, t } = await getI18n();
  const isAdmin = roles.includes("admin");
  // Staff pages get their words in the client too (D020).
  const isStaff = isAdmin || roles.includes("committee") || roles.includes("system_admin");
  const roleLabel = roles.length > 0 ? roles.join(", ") : t.shell.user;

  return (
    <>
      {/* Sticky only from tablet up: on phones a sticky header covered a
          third of the screen and hid questions the browser scrolled to. */}
      <header className="z-30 border-b border-[var(--border)] bg-[var(--background)] md:sticky md:top-0 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{APP_NAME}</div>
              <div className="hidden text-xs text-[var(--muted)] sm:block">
                v{APP_VERSION}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <HelpLink label={t.shell.help} />
            <LanguageSwitcher locale={locale} />
            <div className="min-w-0 text-right sm:rounded-md sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:px-3 sm:py-2 sm:text-left md:max-w-72">
              <div className="truncate font-medium">{profile.full_name}</div>
              <div className="hidden truncate text-xs text-[var(--muted)] sm:block">
                {profile.email} / {profile.default_status} / {roleLabel}
              </div>
            </div>
            <form action={signOut}>
              <TrackedSubmitButton
                aria-label={t.shell.signOut}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
                debugName="auth.logout"
                pendingLabel={t.shell.signingOut}
                type="submit"
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{t.shell.signOut}</span>
              </TrackedSubmitButton>
            </form>
          </div>
        </div>
        <AppShellNav
          labels={{
            ...t.shell.nav,
            ...t.shell.crumbs,
            back: t.shell.back,
            adminSections: isStaff ? getStaffDictionary(locale).adminHome.nav : undefined,
          }}
          isAdmin={isAdmin}
          isCommittee={roles.includes("committee")}
          isSystemAdmin={roles.includes("system_admin")}
        />
      </header>
      <div className="print:hidden">
        <AppFeedbackBanner dismissLabel={t.shell.dismiss} locale={locale} />
        {profile.approval_status !== "approved" ? (
          <div className="mx-auto max-w-6xl px-4 pt-3 md:px-6">
            <ApprovalNotice status={profile.approval_status} text={t.shell} />
          </div>
        ) : null}
      </div>
      {isStaff ? (
        <StaffTextProvider locale={locale} s={getStaffDictionary(locale)}>
          {children}
        </StaffTextProvider>
      ) : (
        children
      )}
    </>
  );
}
