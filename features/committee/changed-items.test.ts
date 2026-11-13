import { describe, expect, it } from "vitest";
import { changedAgendaItems } from "@/features/committee/changed-items";

const payload = (counts: number[]) => ({
  questions: counts.map((count, index) => ({
    agenda_no: String(index + 1),
    choices: [{ id: "yes", vote_count: count, ownership: count * 2 }],
    outcome: "decided",
  })),
});

describe("changedAgendaItems", () => {
  it("is empty when the numbers are the same", () => {
    expect(changedAgendaItems(payload([3, 4]), payload([3, 4]))).toEqual([]);
  });

  it("names the items whose counts changed", () => {
    expect(changedAgendaItems(payload([3, 4]), payload([3, 5]))).toEqual(["2"]);
  });

  it("counts an added item as changed", () => {
    expect(changedAgendaItems(payload([3]), payload([3, 1]))).toEqual(["2"]);
  });
});
