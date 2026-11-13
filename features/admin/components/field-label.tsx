"use client";

import type { ReactNode } from "react";
import { useStaffText } from "@/lib/i18n/staff/client";

// One required mark for every form (demo feedback item 9): a darker red that
// keeps more than 4.5:1 contrast on white and on the light surfaces, bold so
// it stands out. Screen readers hear "required" from the field itself.
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="required-mark">
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
