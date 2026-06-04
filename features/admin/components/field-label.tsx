import type { ReactNode } from "react";

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  );
}

export function RequiredNote() {
  return (
    <p className="text-xs text-[var(--muted)]">
      Fields marked with <RequiredMark /> are required.
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
