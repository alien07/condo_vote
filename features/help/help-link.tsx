"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { helpHrefForPath } from "@/lib/help";

// "?" in the header: opens the help topic for the current page.
export function HelpLink({ label }: { label: string }) {
  const pathname = usePathname();

  return (
    <Link
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
      href={helpHrefForPath(pathname)}
      title={label}
    >
      <CircleHelp aria-hidden size={18} />
    </Link>
  );
}
