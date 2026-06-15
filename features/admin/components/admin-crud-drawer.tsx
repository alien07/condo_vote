"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";

type AdminCrudDrawerProps = {
  children: React.ReactNode;
  closeHref: string;
  summary?: string[];
  title: string;
};

export function AdminCrudDrawer({
  children,
  closeHref,
  summary,
  title,
}: AdminCrudDrawerProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end overflow-hidden bg-black/10">
      <aside
        aria-label={title}
        className="flex h-full w-full max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl sm:max-w-xl"
        role="complementary"
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {summary?.length ? (
                <dl className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                  {summary.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </dl>
              ) : null}
            </div>
            <Link
              aria-label="Close drawer"
              className="rounded-md border border-[var(--border)] p-2"
              href={closeHref}
            >
              <X size={18} />
            </Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
