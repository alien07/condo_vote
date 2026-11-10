"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
      onClick={() => window.print()}
      type="button"
    >
      <Printer aria-hidden="true" size={16} />
      {label}
    </button>
  );
}
