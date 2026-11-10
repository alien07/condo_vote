import { describe, expect, it } from "vitest";
import {
  bangkokDateTimeParts,
  bangkokLocalToIso,
  formatBangkokDateTime,
  isoToBangkokLocalInput,
  todayInBangkok,
} from "@/lib/datetime";

// These run with TZ=UTC (see vitest.config.ts), like a hosted server.
describe("Bangkok time helpers", () => {
  it("reads a datetime-local value as Bangkok time", () => {
    expect(bangkokLocalToIso("2026-11-13T13:00")).toBe("2026-11-13T06:00:00.000Z");
    expect(bangkokLocalToIso("2026-11-13T13:00:30")).toBe("2026-11-13T06:00:30.000Z");
  });

  it("keeps values that already have a zone", () => {
    expect(bangkokLocalToIso("2026-11-13T06:00:00.000Z")).toBe("2026-11-13T06:00:00.000Z");
  });

  it("returns null for empty or invalid input", () => {
    expect(bangkokLocalToIso("")).toBeNull();
    expect(bangkokLocalToIso("not a date")).toBeNull();
  });

  it("round-trips through the datetime-local input value", () => {
    const iso = bangkokLocalToIso("2026-11-13T00:30");

    expect(isoToBangkokLocalInput(iso)).toBe("2026-11-13T00:30");
  });

  it("formats and splits in Bangkok time across the UTC date line", () => {
    // 20:00 UTC on 12 Nov is 03:00 on 13 Nov in Bangkok.
    expect(formatBangkokDateTime("2026-11-12T20:00:00Z")).toBe("13 Nov 2026, 03:00");
    expect(bangkokDateTimeParts("2026-11-12T20:00:05Z")).toEqual({
      date: "13/11/2026",
      time: "03:00:05",
    });
    expect(todayInBangkok(new Date("2026-11-12T20:00:00Z"))).toBe("2026-11-13");
  });
});
