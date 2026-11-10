import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";

export default function RecordLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
