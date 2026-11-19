import { describe, expect, it } from "vitest";
import { meetingSearchOptions, roomFilterOptions, uniqueById } from "@/features/ui/search-options";

describe("roomFilterOptions", () => {
  it("lists each room once, by number, with the id as the value", () => {
    const options = roomFilterOptions([
      { id: "r10", room_number: "A-10", building: "A" },
      null,
      { id: "r2", room_number: "A-2", building: null },
      { id: "r10", room_number: "A-10", building: "A" },
      undefined,
    ]);

    expect(options).toEqual([
      { value: "r2", label: "A-2", hint: undefined },
      { value: "r10", label: "A-10", hint: "A" },
    ]);
  });
});

describe("uniqueById", () => {
  it("keeps the first row of each id", () => {
    expect(
      uniqueById([
        { id: "m1", title: "First" },
        { id: "m1", title: "Renamed" },
        { id: "m2", title: "Second" },
      ]),
    ).toEqual([
      { id: "m1", title: "First" },
      { id: "m2", title: "Second" },
    ]);
  });
});

describe("meetingSearchOptions", () => {
  it("submits the meeting id, never the title", () => {
    expect(meetingSearchOptions([{ id: "m1", title: "AGM 2026" }])[0]).toMatchObject({
      value: "m1",
      label: "AGM 2026",
    });
  });
});
