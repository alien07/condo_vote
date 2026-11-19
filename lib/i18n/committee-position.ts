// Built-in committee positions (D026, migration 0045). The database keeps
// the code; position_title holds the typed title only for "other". Pages show
// the label in the page language from s.setup.positions.

export const COMMITTEE_POSITION_CODES = [
  "chair",
  "vice_chair",
  "secretary",
  "assistant_secretary",
  "treasurer",
  "member",
  "other",
] as const;

export type CommitteePositionCode = (typeof COMMITTEE_POSITION_CODES)[number];

export const DEFAULT_COMMITTEE_POSITION: CommitteePositionCode = "member";

export function isCommitteePositionCode(value: unknown): value is CommitteePositionCode {
  return typeof value === "string" && (COMMITTEE_POSITION_CODES as readonly string[]).includes(value);
}

/** The position in words: the typed title for "other", else the label of the code. */
export function committeePositionLabel(
  labels: Record<string, string>,
  code: string | null | undefined,
  title: string | null | undefined,
) {
  const typed = title?.trim();

  if (!code || code === "other" || !isCommitteePositionCode(code)) {
    return typed || (code && code !== "other" ? code : "-");
  }

  return labels[code] ?? code;
}

/** Sort order: chair first, then the list order; "other" last. */
export function committeePositionRank(code: string | null | undefined) {
  const index = COMMITTEE_POSITION_CODES.indexOf(code as CommitteePositionCode);

  return index === -1 ? COMMITTEE_POSITION_CODES.length : index;
}
