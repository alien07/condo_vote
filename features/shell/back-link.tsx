import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** "Back to …" link above a page title: an arrow and link colour so it reads
 * as something to click (2026-11-19). */
export function BackLink({
  children,
  className = "",
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link
      className={`-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${className}`}
      href={href}
    >
      <ArrowLeft aria-hidden className="shrink-0" size={16} />
      {children}
    </Link>
  );
}
