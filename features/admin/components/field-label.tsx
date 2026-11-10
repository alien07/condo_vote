"use client";

import type { ReactNode } from "react";
import { useStaffText } from "@/lib/i18n/staff/client";

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  );
}

export function RequiredNote() {
  const { s } = useStaffText();
  const [before, after] = s.common.requiredNote.split("{mark}");

  return (
    <p className="text-xs text-[var(--muted)]">
      {before}
      <RequiredMark />
      {after}
    </p>
  );
}

type FieldLabelProps = {
  children: ReactNode;
  required?: boolean;
};

export function FieldLabel({ children, required = false }: FieldLabelProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {required ? <RequiredMark /> : null}
    </span>
  );
}
