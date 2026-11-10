// Pass rules for meeting questions (D013) and the meeting quorum.
// Pure functions: no database access, covered by Vitest in pass-rules.test.ts.

export type PassBasis = "voting_ownership" | "total_ownership" | "none";
export type PassOperator = "gt" | "gte";

export type PassRule = {
  basis: PassBasis;
  operator: PassOperator;
  /** Percentage of the basis, 0-100. */
  percent: number;
};

/**
 * Presets stored in meeting_questions.required_threshold. "custom" means the
 * admin set basis, operator, and percent directly.
 */
export const PASS_RULE_PRESETS = {
  majority_submitted: { basis: "voting_ownership", operator: "gt", percent: 50 },
  half_total: { basis: "total_ownership", operator: "gt", percent: 50 },
  one_third_total: { basis: "total_ownership", operator: "gte", percent: 100 / 3 },
  three_fourths_total: { basis: "total_ownership", operator: "gte", percent: 75 },
  informational: { basis: "none", operator: "gte", percent: 0 },
} as const satisfies Record<string, PassRule>;

export type PassRulePreset = keyof typeof PASS_RULE_PRESETS | "custom";

export const PASS_BASIS_LABELS: Record<PassBasis, string> = {
  voting_ownership: "ownership of rooms that voted",
  total_ownership: "total project ownership",
  none: "no pass rule",
};

export function isPassBasis(value: string): value is PassBasis {
  return value in PASS_BASIS_LABELS;
}

export function isPassOperator(value: string): value is PassOperator {
  return value === "gt" || value === "gte";
}

export function passRuleForPreset(preset: string): PassRule | null {
  return preset in PASS_RULE_PRESETS
    ? PASS_RULE_PRESETS[preset as keyof typeof PASS_RULE_PRESETS]
    : null;
}

export function formatPercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

/** Example: "More than 50% of ownership of rooms that voted". */
export function describePassRule(rule: PassRule) {
  if (rule.basis === "none") {
    return "Informational, no pass rule";
  }

  const operator = rule.operator === "gt" ? "More than" : "At least";

  return `${operator} ${formatPercent(rule.percent)} of ${PASS_BASIS_LABELS[rule.basis]}`;
}

// Ownership values are decimals; compare with a small tolerance.
const EPSILON = 1e-9;

export function meetsPassRule(
  ownership: number,
  basisOwnership: number,
  rule: PassRule,
) {
  if (rule.basis === "none" || basisOwnership <= 0) {
    return false;
  }

  const left = ownership * 100;
  const right = rule.percent * basisOwnership;

  return rule.operator === "gt" ? left > right + EPSILON : left >= right - EPSILON;
}

export type ChoiceTally = {
  id: string;
  ownership: number;
  isAbstain: boolean;
};

export type QuestionOutcome = {
  basis_ownership: number | null;
  choices: Array<{
    id: string;
    percent_of_basis: number | null;
    meets_rule: boolean;
  }>;
  passed_choice_ids: string[];
  /** Single choice only: the one non-abstain choice that meets the rule. */
  decided_choice_id: string | null;
  outcome: "decided" | "not_decided" | "informational";
};

/**
 * Evaluates one question.
 * - votingOwnership: ownership of all rooms with an effective ballot,
 *   including rooms that chose Abstain (D013).
 * - Abstain choices never meet the rule.
 * - Single choice: decided when exactly one non-abstain choice meets the rule.
 * - Multiple choice: decided when at least one choice meets the rule; every
 *   choice is evaluated on its own.
 */
export function evaluateQuestion(input: {
  rule: PassRule;
  questionType: string;
  choices: ChoiceTally[];
  votingOwnership: number;
  totalOwnership: number;
}): QuestionOutcome {
  const { rule } = input;

  if (rule.basis === "none") {
    return {
      basis_ownership: null,
      choices: input.choices.map((choice) => ({
        id: choice.id,
        percent_of_basis: null,
        meets_rule: false,
      })),
      passed_choice_ids: [],
      decided_choice_id: null,
      outcome: "informational",
    };
  }

  const basisOwnership =
    rule.basis === "voting_ownership" ? input.votingOwnership : input.totalOwnership;
  const choices = input.choices.map((choice) => ({
    id: choice.id,
    percent_of_basis:
      basisOwnership > 0 ? (choice.ownership / basisOwnership) * 100 : 0,
    meets_rule:
      !choice.isAbstain && meetsPassRule(choice.ownership, basisOwnership, rule),
  }));
  const passed = choices.filter((choice) => choice.meets_rule).map((choice) => choice.id);
  const single = input.questionType !== "multiple_choice";
  const decided = single ? passed.length === 1 : passed.length > 0;

  return {
    basis_ownership: basisOwnership,
    choices,
    passed_choice_ids: passed,
    decided_choice_id: single && passed.length === 1 ? passed[0] : null,
    outcome: decided ? "decided" : "not_decided",
  };
}

/** Quorum rules stored in meetings.quorum_rule. */
export const QUORUM_RULES: Record<string, { label: string; percent: number }> = {
  one_fourth_total_ownership: { label: "At least 1/4 of total ownership", percent: 25 },
  one_third_total_ownership: { label: "At least 1/3 of total ownership", percent: 100 / 3 },
  not_required_second_call: { label: "Second call, no quorum required", percent: 0 },
};

export function evaluateQuorum(rule: string, votingOwnership: number, totalOwnership: number) {
  const quorum = QUORUM_RULES[rule];

  if (!quorum) {
    return { rule, label: rule, required_percent: null, met: null };
  }

  return {
    rule,
    label: quorum.label,
    required_percent: quorum.percent,
    met: meetsPassRule(votingOwnership, totalOwnership, {
      basis: "total_ownership",
      operator: "gte",
      percent: quorum.percent,
    }),
  };
}
