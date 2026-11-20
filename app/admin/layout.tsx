import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";
import { AdminSectionNav, type AdminNavGroup } from "@/features/admin/components/admin-section-nav";
import { getStaffI18n } from "@/lib/i18n/server";
import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/route-access";

type NavKey =
  | "overview"
  | "setup"
  | "documents"
  | "people"
  | "ownership"
  | "meetings"
  | "voting"
  | "results"
  | "proxies"
  | "communications";

// Grouped by job: master data first, then the meeting itself, then one-time setup.
const adminNavGroups: { group?: "master" | "meeting" | "settings"; items: [string, NavKey][] }[] = [
  { items: [["/admin", "overview"]] },
  {
    group: "master",
    items: [
      ["/admin/people", "people"],
      ["/admin/ownership", "ownership"],
    ],
  },
  {
    group: "meeting",
    items: [
      ["/admin/meetings", "meetings"],
      ["/admin/proxies", "proxies"],
      ["/admin/voting", "voting"],
      ["/admin/results", "results"],
      ["/admin/communications", "communications"],
    ],
  },
  {
    group: "settings",
    items: [
      ["/admin/setup", "setup"],
      ["/admin/documents", "documents"],
    ],
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ s }, current] = await Promise.all([getStaffI18n(), getCurrentProfileWithRoles()]);
  // Office staff do data entry only (demo feedback item 14c): the menu shows
  // the pages these roles may open (lib/auth/route-access.ts, req_0009).
  const roles = current?.roles ?? [];
  const text = s.adminHome;

  const groups: AdminNavGroup[] = adminNavGroups
    .map(({ group, items }) => ({
      label: group ? text.navGroups[group] : undefined,
      items: items
        .filter(([href]) => canOpen(href, roles))
        .map(([href, key]) => ({ href, label: text.nav[key] })),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AuthenticatedShell>
      <AdminSectionNav ariaLabel={text.navLabel} groups={groups} menuLabel={text.navMenu} />
      {children}
    </AuthenticatedShell>
  );
}
