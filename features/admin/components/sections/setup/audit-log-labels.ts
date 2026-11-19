import { formatDateIn, formatDateTimeIn } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import type { StaffDictionary } from "@/lib/i18n/staff";

// Audit log codes in words (setup page review 2026-11-19). The filter still
// submits the stored codes; only what people read changes.

type AuditLogWords = StaffDictionary["auditLog"];

export type AuditActionGroup = "meetings" | "voting" | "results" | "settings" | "other";

export const AUDIT_ACTION_GROUPS: AuditActionGroup[] = ["meetings", "voting", "results", "settings", "other"];

const GROUP_BY_PREFIX: Record<string, AuditActionGroup> = {
  meeting: "meetings",
  ballot: "voting",
  manual_ballot: "voting",
  vote_source_conflict: "voting",
  proxy_authorization: "voting",
  proxy: "voting",
  result_snapshot: "results",
  result_documents: "results",
  result: "results",
  app_settings: "settings",
  privacy_settings: "settings",
  document: "settings",
};

/** An action code in words; an unknown code is shown as stored. */
export function auditActionLabel(words: AuditLogWords, code: string) {
  return words.actions[code] ?? code;
}

/** A record type code in words; an unknown code is shown as stored. */
export function auditEntityLabel(words: AuditLogWords, code: string) {
  return words.entities[code] ?? code;
}

export function auditActionGroup(code: string): AuditActionGroup {
  return GROUP_BY_PREFIX[code.split(".")[0]] ?? "other";
}

/** Action codes in filter groups, each group sorted by its label. Empty groups are left out. */
export function groupAuditActions(words: AuditLogWords, codes: string[]) {
  return AUDIT_ACTION_GROUPS.map((group) => ({
    group,
    label: words.groups[group],
    actions: codes
      .filter((code) => auditActionGroup(code) === group)
      .map((code) => ({ code, label: auditActionLabel(words, code) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  })).filter((entry) => entry.actions.length > 0);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_INSIDE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** A short form of a long id, for the rare id that is worth showing. */
export function shortId(value: string) {
  return isUuid(value) ? `${value.slice(0, 8)}…` : value;
}

function fieldLabel(words: AuditLogWords, key: string) {
  const known = words.fields[key];

  if (known) {
    return known;
  }

  const plain = key.replace(/_/g, " ").trim();

  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

function valueText(
  words: AuditLogWords,
  codes: Record<string, string>,
  locale: Locale,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? words.yes : words.no;
  }

  if (typeof value === "number") {
    return value.toLocaleString(locale === "th" ? "th-TH" : "en-GB");
  }

  if (typeof value === "string") {
    if (isUuid(value)) {
      return shortId(value);
    }

    if (DATE_ONLY.test(value)) {
      return formatDateIn(locale, `${value}T00:00:00+07:00`);
    }

    if (DATE_TIME.test(value)) {
      return formatDateTimeIn(locale, value);
    }

    return words.values[value] ?? codes[value] ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueText(words, codes, locale, item)).join(", ");
  }

  return JSON.stringify(value);
}

export type AuditDetailPair = { key: string; label: string; value: string };

/**
 * Details as "label: value" pairs. Fields that only hold a record id
 * (meeting_id, room_id, ...) are left out: the full data stays in "Raw data".
 */
export function auditDetailPairs(
  s: Pick<StaffDictionary, "auditLog" | "common">,
  locale: Locale,
  details: unknown,
): AuditDetailPair[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }

  return Object.entries(details as Record<string, unknown>)
    .filter(([key, value]) => !((key === "id" || key.endsWith("_id")) && (isUuid(value) || value === null)))
    // A made-up key with an id inside ("profile:<uuid>:owner_verification",
    // an automatic document set) says nothing to a reader; Raw data keeps it.
    .filter(([, value]) => !(typeof value === "string" && !isUuid(value) && UUID_INSIDE.test(value)))
    .map(([key, value]) => ({
      key,
      label: fieldLabel(s.auditLog, key),
      value: valueText(s.auditLog, s.common.code, locale, value),
    }));
}

/** True when the details hold anything at all (then "Raw data" is offered). */
export function hasAuditDetails(details: unknown) {
  return Boolean(details && typeof details === "object" && Object.keys(details as object).length > 0);
}
