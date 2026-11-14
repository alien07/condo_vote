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

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  th: new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }),
};

/** Date only, e.g. "13 พ.ย. 2569" or "13 Nov 2026". */
export function formatDateIn(locale: Locale, value: string | null | undefined) {
  return value ? dateFormatters[locale].format(new Date(value)) : "-";
}

/**
 * How long a span of time is, in the largest two units: "2 วัน 4 ชม." /
 * "2 days 4 hours". Used for "how much earlier than planned" (close-early
 * requests).
 */
export function formatDurationIn(locale: Locale, ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const units =
    locale === "th"
      ? { d: (n: number) => `${n} วัน`, h: (n: number) => `${n} ชม.`, m: (n: number) => `${n} นาที` }
      : {
          d: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
          h: (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`,
          m: (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`,
        };
  const parts = [days ? units.d(days) : "", hours ? units.h(hours) : "", !days && mins ? units.m(mins) : ""].filter(Boolean);

  return parts.slice(0, 2).join(" ") || units.m(0);
}
