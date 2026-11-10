"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StaffDictionary } from "@/lib/i18n/staff";
import type { Locale } from "@/lib/i18n/locales";

// Staff words for client components, given by the authenticated shell.
const StaffTextContext = createContext<{ locale: Locale; s: StaffDictionary } | null>(null);

export function StaffTextProvider({
  children,
  locale,
  s,
}: {
  children: ReactNode;
  locale: Locale;
  s: StaffDictionary;
}) {
  return <StaffTextContext.Provider value={{ locale, s }}>{children}</StaffTextContext.Provider>;
}

export function useStaffText() {
  const value = useContext(StaffTextContext);

  if (!value) {
    throw new Error("useStaffText needs StaffTextProvider (staff pages only).");
  }

  return value;
}
