import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Gavel,
  LifeBuoy,
  Server,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { HomeAuthControls } from "@/features/auth/home-auth-controls";
import { TrackedLink } from "@/features/debug/tracked-link";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";
import { ApprovalNotice } from "@/features/shell/approval-notice";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ denied?: string }>;
};

// Cards follow the signed-in user's roles; every page still checks access on
// the server. `?denied=1` comes from a page the account cannot open.
export default async function HomePage({ searchParams }: HomePageProps) {
  const [{ locale, t: dict }, { denied }, current] = await Promise.all([
    getI18n(),
    searchParams,
    getCurrentProfileWithRoles(),
  ]);
  const t = dict.home;
  const roles = current?.roles ?? [];
  const sections = [
    {
      href: "/vote",
      debugName: "vote",
      label: t.voteTitle,
      description: t.voteText,
      icon: ClipboardCheck,
      show: true,
    },
    {
      href: "/summary",
      debugName: "summary",
      label: t.summaryTitle,
      description: t.summaryText,
      icon: BarChart3,
      show: true,
    },
    {
      href: "/committee",
      debugName: "committee",
      label: t.committeeTitle,
      description: t.committeeText,
      icon: Gavel,
      show: roles.includes("committee") || roles.includes("admin"),
    },
    {
      href: "/admin",
      debugName: "admin",
      label: t.adminTitle,
      description: t.adminText,
      icon: Settings,
      show: roles.includes("admin"),
    },
    {
      href: "/system",
      debugName: "system",
      label: t.systemTitle,
      description: t.systemText,
      icon: Server,
      show: roles.includes("system_admin"),
    },
    {
      href: "/help/owner",
      debugName: "help",
      label: t.helpTitle,
      description: t.helpText,
      icon: LifeBuoy,
      show: true,
    },
  ].filter((section) => section.show);

  return (
    <main className="min-h-screen px-6 py-8" lang={locale}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
              <p className="text-sm text-[var(--muted)]">
                {t.tagline} v{APP_VERSION}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher locale={locale} />
            <HomeAuthControls
              initialCurrent={
                current
                  ? {
                      profile: {
                        default_status: current.profile.default_status,
                        email: current.profile.email,
                        full_name: current.profile.full_name,
                      },
                      roles: current.roles,
                    }
                  : null
              }
              labels={{
                signIn: t.signIn,
                signOut: dict.shell.signOut,
                signingOut: dict.shell.signingOut,
                user: dict.shell.user,
              }}
            />
          </div>
        </header>

        {denied && current ? (
          <p
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <ShieldAlert aria-hidden className="mt-0.5 shrink-0" size={16} />
            <span>{t.denied}</span>
          </p>
        ) : null}
        <ApprovalNotice status={current?.profile.approval_status} text={dict.shell} />
        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <TrackedLink
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                debugName={`home.${section.debugName}`}
                href={section.href}
                key={section.href}
              >
                <Icon className="mb-4 text-[var(--primary)]" size={24} />
                <h2 className="text-lg font-semibold">{section.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {section.description}
                </p>
              </TrackedLink>
            );
          })}
        </section>
      </div>
    </main>
  );
}
