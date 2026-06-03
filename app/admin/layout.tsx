import Link from "next/link";
import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";

const adminNav = [
  ["/admin", "Overview"],
  ["/admin/setup", "Setup"],
  ["/admin/people", "People"],
  ["/admin/ownership", "Ownership"],
  ["/admin/meetings", "Meetings"],
  ["/admin/voting", "Voting"],
  ["/admin/results", "Results"],
  ["/admin/proxies", "Proxies"],
  ["/admin/communications", "Communications"],
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedShell>
      <nav className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto text-sm">
          {adminNav.map(([href, label]) => (
            <Link
              className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </AuthenticatedShell>
  );
}
