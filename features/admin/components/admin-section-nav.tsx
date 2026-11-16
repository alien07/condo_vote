"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export type AdminNavItem = { href: string; label: string };
export type AdminNavGroup = { label?: string; items: AdminNavItem[] };

type AdminSectionNavProps = {
  groups: AdminNavGroup[];
  /** Accessible name of the nav landmark, e.g. "Admin menu". */
  ariaLabel: string;
  /** Prefix of the phone menu button, e.g. "Menu". */
  menuLabel: string;
};

/** "/admin" matches only itself; every other section also owns its sub-pages. */
export function isActiveAdminHref(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSectionNav({ groups, ariaLabel, menuLabel }: AdminSectionNavProps) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const items = groups.flatMap((group) => group.items);
  const current = items.find((item) => isActiveAdminHref(pathname, item.href));

  useEffect(() => {
    // Keep the open section in view when the strip is wider than the screen.
    // Scroll only the strip: scrollIntoView would also move the page and any
    // open drawer.
    const strip = stripRef.current;
    const activeLink = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (strip && activeLink) {
      const left = activeLink.offsetLeft - strip.offsetLeft;
      const right = left + activeLink.offsetWidth;
      if (left < strip.scrollLeft) {
        strip.scrollLeft = left;
      } else if (right > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = right - strip.clientWidth;
      }
    }
    // Close the phone menu after the person picks a section.
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }, [pathname]);

  return (
    <nav
      aria-label={ariaLabel}
      className="border-b border-[var(--border)] bg-[var(--background)] print:hidden"
    >
      {/* Phones: one button that opens the grouped list. */}
      <details className="group mx-auto max-w-[var(--page-max)] px-4 py-2 md:hidden" ref={menuRef}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="truncate">
            <span className="text-[var(--muted)]">{menuLabel}: </span>
            {current?.label ?? items[0]?.label}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="shrink-0 transition-transform group-open:rotate-180"
            size={16}
          />
        </summary>
        <div className="mt-2 flex flex-col gap-3 pb-1">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`}>
              {group.label ? (
                <div className="px-3 pb-1 text-xs font-medium text-[var(--muted)]">
                  {group.label}
                </div>
              ) : null}
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const active = isActiveAdminHref(pathname, item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex min-h-11 items-center rounded-md px-3 text-sm",
                          active
                            ? "bg-[var(--primary)] font-medium text-[var(--primary-foreground)]"
                            : "text-[var(--foreground)] hover:bg-[var(--surface)]",
                        ].join(" ")}
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* Tablet and up: an underlined tab strip, one step below the role buttons. */}
      <div className="relative mx-auto hidden max-w-[var(--page-max)] px-4 md:block md:px-6">
        <div
          className="flex items-end gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={stripRef}
        >
          {groups.map((group, groupIndex) => (
            <div
              className={[
                "flex shrink-0 items-end gap-1",
                // Dividers mark the groups; their names are read out via aria-label.
                groupIndex > 0 ? "ml-1 border-l border-[var(--border)] pl-1" : "",
              ].join(" ")}
              key={group.label ?? `group-${groupIndex}`}
              role="group"
              aria-label={group.label}
            >
              {group.items.map((item) => {
                const active = isActiveAdminHref(pathname, item.href);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 font-medium",
                      active
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--foreground)]",
                    ].join(" ")}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        {/* Fade on the right edge hints that the strip scrolls on narrow tablets. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--background)] xl:hidden"
        />
      </div>
    </nav>
  );
}
