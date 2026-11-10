import { describe, expect, it } from "vitest";
import {
  PASS_RULE_PRESETS,
  describePassRule,
  evaluateQuestion,
  evaluateQuorum,
  meetsPassRule,
} from "@/features/results/pass-rules";

// Hand-calculated example used below:
// Total project ownership 100. Rooms that voted: 60 (Yes 31, No 20, Abstain 9).
const yesNo = [
  { id: "yes", ownership: 31, isAbstain: false },
  { id: "no", ownership: 20, isAbstain: false },
  { id: "abstain", ownership: 9, isAbstain: true },
];

describe("meetsPassRule", () => {
  it("'more than' excludes the exact boundary", () => {
    const rule = { basis: "voting_ownership", operator: "gt", percent: 50 } as const;
    expect(meetsPassRule(30, 60, rule)).toBe(false); // exactly 50%
    expect(meetsPassRule(30.01, 60, rule)).toBe(true);
  });

  it("'at least' includes the exact boundary", () => {
    const rule = { basis: "total_ownership", operator: "gte", percent: 75 } as const;
    expect(meetsPassRule(75, 100, rule)).toBe(true);
    expect(meetsPassRule(74.99, 100, rule)).toBe(false);
  });

  it("treats 1/3 with decimal ownership as reached", () => {
    // 33.333333 of 100 is 1/3 within the stored 6-decimal precision.
    expect(meetsPassRule(100 / 3, 100, PASS_RULE_PRESETS.one_third_total)).toBe(true);
  });

  it("never passes with an empty basis", () => {
    expect(meetsPassRule(0, 0, PASS_RULE_PRESETS.majority_submitted)).toBe(false);
  });
});

describe("evaluateQuestion", () => {
  it("counts Abstain in the voting basis: 31/60 = 51.67% > 50% passes", () => {
    const result = evaluateQuestion({
      rule: PASS_RULE_PRESETS.majority_submitted,
      questionType: "single_choice",
      choices: yesNo,
      votingOwnership: 60,
      totalOwnership: 100,
    });

    expect(result.basis_ownership).toBe(60);
    expect(result.choices[0].percent_of_basis).toBeCloseTo(51.6667, 3);
    expect(result.decided_choice_id).toBe("yes");
    expect(result.outcome).toBe("decided");
  });

  it("fails on total ownership: 31/100 = 31% is not more than 50%", () => {
    const result = evaluateQuestion({
      rule: PASS_RULE_PRESETS.half_total,
      questionType: "single_choice",
      choices: yesNo,
      votingOwnership: 60,
      totalOwnership: 100,
    });

    expect(result.passed_choice_ids).toEqual([]);
    expect(result.outcome).toBe("not_decided");
  });

  it("never lets Abstain meet the rule", () => {
    const result = evaluateQuestion({
      rule: { basis: "voting_ownership", operator: "gte", percent: 10 },
      questionType: "single_choice",
      choices: [
        { id: "yes", ownership: 5, isAbstain: false },
        { id: "abstain", ownership: 55, isAbstain: true },
      ],
      votingOwnership: 60,
      totalOwnership: 100,
    });

    expect(result.passed_choice_ids).toEqual([]);
  });

  it("single choice with two choices over the bar is not decided", () => {
    const result = evaluateQuestion({
      rule: { basis: "voting_ownership", operator: "gte", percent: 30 },
      questionType: "single_choice",
      choices: yesNo,
      votingOwnership: 60,
      totalOwnership: 100,
    });

    // yes 51.67% and no 33.33% both reach 30%.
    expect(result.passed_choice_ids).toEqual(["yes", "no"]);
    expect(result.decided_choice_id).toBeNull();
    expect(result.outcome).toBe("not_decided");
  });

  it("multiple choice evaluates each choice on its own", () => {
    const result = evaluateQuestion({
      rule: { basis: "voting_ownership", operator: "gte", percent: 40 },
      questionType: "multiple_choice",
      choices: [
        { id: "a", ownership: 45, isAbstain: false }, // 75%
        { id: "b", ownership: 24, isAbstain: false }, // 40%
        { id: "c", ownership: 10, isAbstain: false }, // 16.67%
      ],
      votingOwnership: 60,
      totalOwnership: 100,
    });

    expect(result.passed_choice_ids).toEqual(["a", "b"]);
    expect(result.decided_choice_id).toBeNull();
    expect(result.outcome).toBe("decided");
  });

  it("informational questions have no outcome", () => {
    const result = evaluateQuestion({
      rule: PASS_RULE_PRESETS.informational,
      questionType: "single_choice",
      choices: yesNo,
      votingOwnership: 60,
      totalOwnership: 100,
    });

    expect(result.outcome).toBe("informational");
    expect(result.basis_ownership).toBeNull();
  });
});

describe("evaluateQuorum", () => {
  it("1/4 of total ownership: 25 of 100 is met, 24.99 is not", () => {
    expect(evaluateQuorum("one_fourth_total_ownership", 25, 100).met).toBe(true);
    expect(evaluateQuorum("one_fourth_total_ownership", 24.99, 100).met).toBe(false);
  });

  it("returns null for an unknown rule", () => {
    expect(evaluateQuorum("unknown", 50, 100).met).toBeNull();
  });
});

describe("describePassRule", () => {
  it("describes presets in plain words", () => {
    expect(describePassRule(PASS_RULE_PRESETS.majority_submitted)).toBe(
      "More than 50% of ownership of rooms that voted",
    );
    expect(describePassRule(PASS_RULE_PRESETS.one_third_total)).toBe(
      "At least 33.33% of total project ownership",
    );
  });
});
