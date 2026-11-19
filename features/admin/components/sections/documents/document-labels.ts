import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

// Document codes and data in words (documents review 2026-11-19).

type Words = Pick<StaffDictionary, "documents" | "system">;

export const DOCUMENT_TYPES = [
  "owner_verification",
  "proxy_authorization",
  "meeting_attachment",
  "result_pdf",
  "other",
] as const;

export const DOCUMENT_OWNER_TYPES = [
  "profile",
  "proxy_authorization",
  "approval_request",
  "meeting",
  "result_snapshot",
] as const;

export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

/** A document type code in words; an unknown code is shown as stored. */
export function documentTypeLabel(s: Words, code: string) {
  return s.documents.types[code] ?? code;
}

export function storageProviderLabel(s: Words, code: string) {
  return code === "google_drive" ? s.system.googleDrive : code === "local_drive" ? s.system.localDrive : code;
}

export type DocumentOwnerView = { name: string | null; rooms: string[]; meeting: string | null } | null;

/** Whose document: a name and a short hint (rooms, meeting), never an id. */
export function documentOwnerSummary(s: Words, ownerType: string, owner: DocumentOwnerView) {
  const name = owner?.name ?? s.documents.notFound;
  const parts = [
    owner?.rooms.length ? fill(s.documents.rooms, { rooms: owner.rooms.join(", ") }) : null,
    owner?.meeting ?? null,
    ownerType === "result_snapshot" ? s.documents.resultOf : null,
  ].filter((part): part is string => Boolean(part));

  return { name, hint: parts.join(" · ") || (s.documents.ownerTypes[ownerType] ?? null) };
}

/** "abcd…wxyz" for a long checksum; the full value is in the details. */
export function shortChecksum(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

export function formatBytes(locale: "th" | "en", bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const number = size.toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  });

  return `${number} ${units[unit]}`;
}
