"use client";

import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Settings } from "lucide-react";
import { TrackedLink } from "@/features/debug/tracked-link";

type AppShellNavProps = {
  isAdmin: boolean;
};

const navItems = [
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    adminOnly: true,
  },
  {
    href: "/vote",
    label: "Vote",
    icon: CheckSquare,
    adminOnly: false,
  },
  {
    href: "/summary",
    label: "Summary",
    icon: BarChart3,
    adminOnly: false,
  },
];

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  if (parts[0] === "admin") {
    return [
      { href: "/admin", label: "Admin" },
      parts[1]
        ? {
            href: `/admin/${parts[1]}`,
            label: parts[1].replaceAll("-", " "),
          }
        : null,
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }

  if (parts[0] === "vote") {
    return [
      { href: "/vote", label: "Vote" },
      parts.length > 1 ? { href: pathname, label: "Ballot" } : null,
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }

  if (parts[0] === "summary") {
    return [
      { href: "/summary", label: "Summary" },
      parts.length > 1 ? { href: pathname, label: "Result detail" } : null,
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }

  return [];
}

function getBackHref(pathname: string) {
  if (pathname.startsWith("/vote/")) {
    return "/vote";
  }

  if (pathname.startsWith("/summary/")) {
    return "/summary";
  }

  if (pathname.startsWith("/admin/")) {
    return "/admin";
  }

  return null;
}

export function AppShellNav({ isAdmin }: AppShellNavProps) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const backHref = getBackHref(pathname);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:px-6">
        <nav
          aria-label="Primary navigation"
          className="flex gap-2 overflow-x-auto pb-1 text-sm"
        >
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <TrackedLink
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 py-2 font-medium",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                  ].join(" ")}
                  debugName={`shell.nav.${item.label.toLowerCase()}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </TrackedLink>
              );
            })}
        </nav>

        {breadcrumbs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            {backHref ? (
              <TrackedLink
                className="font-medium text-[var(--foreground)]"
                debugName="shell.back"
                href={backHref}
              >
                Back
              </TrackedLink>
            ) : null}
            {backHref ? <span>/</span> : null}
            {breadcrumbs.map((item, index) => (
              <span className="flex items-center gap-2" key={`${item.href}:${index}`}>
                {index > 0 ? <span>/</span> : null}
                <TrackedLink
                  className={
                    index === breadcrumbs.length - 1
                      ? "capitalize text-[var(--foreground)]"
                      : "capitalize hover:text-[var(--foreground)]"
                  }
                  debugName={`shell.breadcrumb.${item.label}`}
                  href={item.href}
                >
                  {item.label}
                </TrackedLink>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
