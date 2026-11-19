import { describe, expect, it } from "vitest";
import { getStaffDictionary } from "@/lib/i18n/staff";
import {
  DOCUMENT_TYPES,
  documentOwnerSummary,
  documentTypeLabel,
  formatBytes,
  shortChecksum,
  storageProviderLabel,
} from "@/features/admin/components/sections/documents/document-labels";

const en = getStaffDictionary("en");
const th = getStaffDictionary("th");

describe("document labels", () => {
  it("names every document type in both languages", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(documentTypeLabel(en, type)).not.toBe(type);
      expect(documentTypeLabel(th, type)).not.toBe(type);
    }
    expect(documentTypeLabel(en, "owner_verification")).toBe("Owner verification");
    expect(documentTypeLabel(th, "proxy_authorization")).toBe("หนังสือมอบฉันทะ");
    expect(documentTypeLabel(en, "new_kind")).toBe("new_kind");
  });

  it("names the storage", () => {
    expect(storageProviderLabel(en, "local_drive")).toBe(en.system.localDrive);
    expect(storageProviderLabel(th, "google_drive")).toBe(th.system.googleDrive);
  });

  it("says whose document it is, never the id", () => {
    expect(documentOwnerSummary(en, "profile", { name: "Somchai", rooms: ["A-101", "A-102"], meeting: null })).toEqual({
      name: "Somchai",
      hint: "Room A-101, A-102",
    });
    expect(documentOwnerSummary(th, "proxy_authorization", { name: "Somchai", rooms: ["A-101"], meeting: "AGM 2026" }).hint).toBe(
      "ห้อง A-101 · AGM 2026",
    );
    expect(documentOwnerSummary(en, "meeting", null)).toEqual({ name: "Record not found", hint: "A meeting" });
  });

  it("shortens the checksum and sizes", () => {
    expect(shortChecksum("a".repeat(60) + "bcde")).toBe("aaaa…bcde");
    expect(shortChecksum(null)).toBeNull();
    expect(formatBytes("en", 123)).toBe("123 B");
    expect(formatBytes("en", 2048)).toBe("2 KB");
    expect(formatBytes("en", 1_572_864)).toBe("1.5 MB");
  });
});
