"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StaffDictionary } from "@/lib/i18n/staff";
import type { Locale } from "@/lib/i18n/locales";
import { translateMessage } from "@/lib/i18n/staff/messages";

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

/** Shows a message from an admin action in the viewer's language. */
export function useMessageText() {
  const value = useContext(StaffTextContext);
  const locale = value?.locale ?? "en";

  return (message: string | null | undefined) => translateMessage(locale, message);
}
