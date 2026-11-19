import { describe, expect, it } from "vitest";
import { getStaffDictionary } from "@/lib/i18n/staff";
import {
  auditActionGroup,
  auditActionLabel,
  auditDetailPairs,
  auditEntityLabel,
  groupAuditActions,
  hasAuditDetails,
  shortId,
} from "@/features/admin/components/sections/setup/audit-log-labels";

const en = getStaffDictionary("en");
const th = getStaffDictionary("th");
const uuid = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";

describe("audit action and record labels", () => {
  it("translates known codes in both languages", () => {
    expect(auditActionLabel(en.auditLog, "result.correction_answered")).toBe("Result correction answered");
    expect(auditActionLabel(th.auditLog, "result.correction_answered")).toBe("ตอบคำขอแก้ไขผล");
    expect(auditEntityLabel(en.auditLog, "result_snapshot")).toBe("Result");
    expect(auditEntityLabel(th.auditLog, "result_snapshot")).toBe("ผลการลงมติ");
  });

  it("shows an unknown code as stored", () => {
    expect(auditActionLabel(en.auditLog, "something.new")).toBe("something.new");
    expect(auditEntityLabel(th.auditLog, "new_table")).toBe("new_table");
  });

  it("has the same codes in Thai and English", () => {
    expect(Object.keys(th.auditLog.actions).sort()).toEqual(Object.keys(en.auditLog.actions).sort());
    expect(Object.keys(th.auditLog.entities).sort()).toEqual(Object.keys(en.auditLog.entities).sort());
    expect(Object.keys(th.auditLog.fields).sort()).toEqual(Object.keys(en.auditLog.fields).sort());
  });
});

describe("audit action groups", () => {
  it("groups by the code prefix, with other as the fallback", () => {
    expect(auditActionGroup("meeting.published")).toBe("meetings");
    expect(auditActionGroup("manual_ballot.imported")).toBe("voting");
    expect(auditActionGroup("proxy.co_owner_granted")).toBe("voting");
    expect(auditActionGroup("result.correction_requested")).toBe("results");
    expect(auditActionGroup("app_settings.updated")).toBe("settings");
    expect(auditActionGroup("owner.profile_linked")).toBe("other");
    expect(auditActionGroup("unknown")).toBe("other");
  });

  it("leaves out empty groups and keeps the codes as values", () => {
    const groups = groupAuditActions(en.auditLog, ["result_snapshot.published", "meeting.published", "x.y"]);

    expect(groups.map((group) => group.group)).toEqual(["meetings", "results", "other"]);
    expect(groups[0].actions).toEqual([{ code: "meeting.published", label: "Meeting published" }]);
    expect(groups[2].actions).toEqual([{ code: "x.y", label: "x.y" }]);
  });
});

describe("audit details", () => {
  it("shows label and value pairs and hides record ids", () => {
    const pairs = auditDetailPairs(en, "en", {
      meeting_id: uuid,
      result_snapshot_id: uuid,
      approvals: 2,
      required_approvals: 3,
      section47_confirmed: true,
      status: "approved",
    });

    expect(pairs.map((pair) => `${pair.label}: ${pair.value}`)).toEqual([
      "Approvals: 2",
      "Approvals needed: 3",
      "Section 47 checked: Yes",
      "Status: approved",
    ]);
  });

  it("translates values and dates to Thai", () => {
    const pairs = auditDetailPairs(th, "th", {
      document_storage_provider: "local_drive",
      ends_at: "2026-11-19",
      status: "approved",
    });

    expect(pairs[0]).toMatchObject({ label: "ที่เก็บเอกสาร", value: "ไดรฟ์ในเครื่อง" });
    expect(pairs[1].label).toBe("สิ้นสุด");
    expect(pairs[1].value).toContain("2569");
    expect(pairs[2].value).toBe(th.common.code.approved);
  });

  it("shortens an id that is not a record link, and words unknown keys", () => {
    const pairs = auditDetailPairs(en, "en", { chosen_ballot: uuid, some_new_field: "x" });

    expect(pairs).toEqual([
      { key: "chosen_ballot", label: "Chosen ballot", value: shortId(uuid) },
      { key: "some_new_field", label: "Some new field", value: "x" },
    ]);
    expect(shortId(uuid)).toBe("3f2b8c1e…");
  });

  it("returns nothing for empty or non-object details", () => {
    expect(auditDetailPairs(en, "en", null)).toEqual([]);
    expect(auditDetailPairs(en, "en", [1, 2])).toEqual([]);
    expect(hasAuditDetails({})).toBe(false);
    expect(hasAuditDetails({ a: 1 })).toBe(true);
  });
});
