import { describe, expect, it } from "vitest";
import { quorumText } from "@/features/results/thai-labels";

describe("quorumText", () => {
  it("shows only 'no quorum required' for a reconvened meeting", () => {
    expect(quorumText("th", { required_percent: 0, met: true })).toBe(
      "ไม่บังคับองค์ประชุม (การประชุมครั้งที่ 2)",
    );
    expect(quorumText("en", { required_percent: 0, met: true })).toBe(
      "No quorum required (reconvened meeting)",
    );
  });

  it("shows the rule and whether it was met otherwise", () => {
    expect(quorumText("en", { required_percent: 25, met: true })).toBe(
      "At least 25% of all ownership — quorum met",
    );
  });
});
