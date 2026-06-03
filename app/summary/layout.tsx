import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";

export default function SummaryLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
