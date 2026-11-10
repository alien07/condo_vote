import type { ReactNode } from "react";
import { AuthenticatedShell } from "@/features/shell/authenticated-shell";

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
