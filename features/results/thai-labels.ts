// Wording for the result documents. The official record is Thai; the owner
// summary follows the owner's language (D020).

import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

type RuleLike = { basis?: string; operator?: string; percent?: number } | null | undefined;
type QuorumLike = { required_percent?: number | null; met?: boolean | null } | null | undefined;

function percent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

// Pass rule, outcome and quorum in either language. The owner summary uses the
// owner's language (D020); the official record is always Thai.
export function passRuleText(locale: Locale, rule: RuleLike) {
  const t = getDictionary(locale).results;

  if (!rule || rule.basis === "none" || rule.percent === undefined) {
    return t.infoOnly;
  }

  const operator = rule.operator === "gte" ? t.ruleAtLeast : t.ruleMore;
  const basis = rule.basis === "total_ownership" ? t.basisTotal : t.basisVoting;

  return `${operator} ${percent(rule.percent)} ${basis}`;
}

export function outcomeText(
  locale: Locale,
  outcome: string | null | undefined,
  decidedChoices: string[],
) {
  const t = getDictionary(locale).results;

  if (outcome === "decided") {
    return t.decided(decidedChoices.join(", "));
  }

  if (outcome === "not_decided") {
    return t.notDecided;
  }

  if (outcome === "informational") {
    return t.informational;
  }

  return "-";
}

export function quorumText(locale: Locale, quorum: QuorumLike) {
  if (!quorum || quorum.required_percent === undefined || quorum.required_percent === null) {
    return "-";
  }

  const t = getDictionary(locale).results;
  const rule =
    quorum.required_percent === 0
      ? t.quorumNotRequired
      : t.quorumRule(percent(quorum.required_percent));
  const result =
    quorum.met === null || quorum.met === undefined
      ? ""
      : ` — ${quorum.met ? t.quorumMet : t.quorumNotMet}`;

  return `${rule}${result}`;
}

export const thaiPassRule = (rule: RuleLike) => passRuleText("th", rule);
export const thaiOutcome = (outcome: string | null | undefined, decided: string[]) =>
  outcomeText("th", outcome, decided);
export const thaiQuorum = (quorum: QuorumLike) => quorumText("th", quorum);

export const THAI_RESOLUTION_TYPES: Record<string, string> = {
  ordinary: "มติทั่วไป",
  special: "มติพิเศษ",
  informational: "เพื่อทราบ",
};

export const THAI_MEETING_TYPES: Record<string, string> = {
  agm: "การประชุมใหญ่สามัญประจำปี",
  egm: "การประชุมใหญ่วิสามัญ",
  online_vote: "การลงมติออนไลน์",
  committee: "การประชุมคณะกรรมการ",
};

export const THAI_MEETING_ROUNDS: Record<string, string> = {
  first: "การประชุมครั้งแรก",
  reconvened: "การประชุมครั้งใหม่ (ครั้งแรกไม่ครบองค์ประชุม)",
};

export const THAI_SIGNATORIES: Record<string, string> = {
  chairperson: "ประธานที่ประชุม",
  manager: "ผู้จัดการนิติบุคคลอาคารชุด",
  minutes_taker: "ผู้บันทึกการประชุม",
  committee_member: "กรรมการ",
};

export function thaiBallotSecrecy(value: string | null | undefined) {
  return value === "secret" ? "ลงคะแนนลับ" : "ลงคะแนนโดยเปิดเผย";
}
