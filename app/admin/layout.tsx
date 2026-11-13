import Link from "next/link";
import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";
import { getStaffI18n } from "@/lib/i18n/server";
import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";

const adminNav = [
  ["/admin", "overview"],
  ["/admin/setup", "setup"],
  ["/admin/documents", "documents"],
  ["/admin/people", "people"],
  ["/admin/ownership", "ownership"],
  ["/admin/meetings", "meetings"],
  ["/admin/voting", "voting"],
  ["/admin/results", "results"],
  ["/admin/proxies", "proxies"],
  ["/admin/communications", "communications"],
] as const;

// Office staff do data entry only (demo feedback item 14c).
const staffNav = new Set<string>(["overview", "people", "ownership", "voting"]);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ s }, current] = await Promise.all([getStaffI18n(), getCurrentProfileWithRoles()]);
  const isManager = current?.roles.includes("admin") ?? false;

  return (
    <AuthenticatedShell>
      <nav className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto text-sm">
          {adminNav.filter(([, key]) => isManager || staffNav.has(key)).map(([href, key]) => (
            <Link
              className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium"
              href={href}
              key={href}
            >
              {s.adminHome.nav[key]}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </AuthenticatedShell>
  );
}
