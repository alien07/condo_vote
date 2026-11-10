// All times are stored in UTC and shown in Bangkok time (D014). The server's
// own time zone must never matter: hosts usually run in UTC, while the dev
// machines run in Bangkok. Thailand has no daylight saving, so the offset is
// fixed at +07:00.

export const APP_TIME_ZONE = "Asia/Bangkok";
const APP_UTC_OFFSET = "+07:00";
const APP_OFFSET_MS = 7 * 60 * 60 * 1000;

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Reads a `datetime-local` value ("2026-11-13T13:00") as Bangkok time and
 * returns an ISO string in UTC. Values that already carry a zone are kept.
 * Returns null for empty or invalid input.
 */
export function bangkokLocalToIso(value: string | null | undefined) {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  const date = localDateTimePattern.test(text)
    ? new Date(`${text}${text.length === 16 ? ":00" : ""}${APP_UTC_OFFSET}`)
    : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** UTC timestamp -> "2026-11-13T13:00" in Bangkok time, for datetime-local inputs. */
export function isoToBangkokLocalInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() + APP_OFFSET_MS).toISOString().slice(0, 16);
}

/** Today's date in Bangkok as "YYYY-MM-DD". */
export function todayInBangkok(now = new Date()) {
  return new Date(now.getTime() + APP_OFFSET_MS).toISOString().slice(0, 10);
}

const mediumDateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

/** "13 Nov 2026, 13:00" in Bangkok time; "-" for empty values. */
export function formatBangkokDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : mediumDateTime.format(date);
}

/** { date: "13/11/2026", time: "13:00:05" } in Bangkok time, for tables. */
export function bangkokDateTimeParts(value: string) {
  const shifted = new Date(new Date(value).getTime() + APP_OFFSET_MS);
  const pad = (part: number) => String(part).padStart(2, "0");

  return {
    date: `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`,
  };
}

const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

/** Thai date with the Buddhist year, e.g. "13 พฤศจิกายน 2569 เวลา 13:00". */
export function formatThaiDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : thaiDateTime.format(date);
}
