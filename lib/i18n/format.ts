import { APP_TIME_ZONE } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n/locales";

// Dates in Asia/Bangkok. Thai uses the Buddhist year, as on Thai documents.
const formatters: Record<Locale, Intl.DateTimeFormat> = {
  th: new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }),
};

export function formatDateTimeIn(locale: Locale, value: string | null | undefined) {
  return value ? formatters[locale].format(new Date(value)) : "-";
}
