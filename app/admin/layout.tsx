import Link from "next/link";
import type { ReactNode } from "react";

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
    <>
      <nav className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)] px-6 py-3">
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto text-sm">
          {adminNav.map(([href, label]) => (
            <Link
              className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
