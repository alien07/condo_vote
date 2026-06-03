import { Building2, ClipboardCheck, Settings } from "lucide-react";
import { HomeAuthControls } from "@/features/auth/home-auth-controls";
import { TrackedLink } from "@/features/debug/tracked-link";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";

export const dynamic = "force-dynamic";

const sections = [
  {
    href: "/admin",
    label: "Admin",
    description: "Manage rooms, owners, meetings, approvals, and results.",
    icon: Settings,
  },
  {
    href: "/vote",
    label: "Vote",
    description: "Open eligible meetings and submit or update ballots.",
    icon: ClipboardCheck,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
              <p className="text-sm text-[var(--muted)]">
                Condominium meeting voting workspace v{APP_VERSION}
              </p>
            </div>
          </div>
          <HomeAuthControls initialCurrent={null} />
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <TrackedLink
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                debugName={`home.${section.label.toLowerCase()}`}
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
