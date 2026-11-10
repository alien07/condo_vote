import { describe, expect, it } from "vitest";
import { translateMessage } from "@/lib/i18n/staff/messages";
import { getStaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

describe("translateMessage", () => {
  it("keeps English as it is", () => {
    expect(translateMessage("en", "Meeting added")).toBe("Meeting added");
  });

  it("translates known messages and patterns to Thai", () => {
    expect(translateMessage("th", "Meeting added")).toBe("เพิ่มการประชุมแล้ว");
    expect(translateMessage("th", "Room number is required.")).toBe("ต้องกรอกเลขห้อง");
    expect(translateMessage("th", "Please fix 2 fields before saving.")).toBe("โปรดแก้ไข 2 ช่องก่อนบันทึก");
    expect(translateMessage("th", "Room A-101 created.")).toBe("เพิ่มห้อง A-101 แล้ว");
  });

  it("shows unknown messages unchanged", () => {
    expect(translateMessage("th", "duplicate key value")).toBe("duplicate key value");
  });
});

describe("staff dictionaries", () => {
  it("have the same placeholders in Thai and English", () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    const walk = (en: unknown, th: unknown, path: string) => {
      if (typeof en === "string") {
        expect(placeholders(th as string), path).toBe(placeholders(en));
        return;
      }

      for (const key of Object.keys(en as object)) {
        walk((en as Record<string, unknown>)[key], (th as Record<string, unknown>)[key], `${path}.${key}`);
      }
    };

    walk(getStaffDictionary("en"), getStaffDictionary("th"), "staff");
  });

  it("fill() replaces placeholders", () => {
    expect(fill("Showing {start}-{end} of {total}", { start: 1, end: 25, total: 93 })).toBe(
      "Showing 1-25 of 93",
    );
  });
});
