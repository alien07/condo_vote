export { formatBangkokDateTime as formatDateTime } from "@/lib/datetime";

export function getResultTotals(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("totals" in payload)) {
    return null;
  }

  const totals = payload.totals;

  if (!totals || typeof totals !== "object") {
    return null;
  }

  return totals as {
    eligible_voters?: number;
    submitted_ballots?: number;
    total_eligible_ownership?: number;
    submitted_ownership?: number;
  };
}

export function getResultPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as {
    generated_at?: string;
    meeting?: {
      title?: string;
      meeting_number?: string | null;
      fiscal_year?: string | null;
      location?: string | null;
      starts_at?: string;
      ends_at?: string;
      chairperson_name?: string | null;
      quorum_rule?: string | null;
    };
    questions?: {
      agenda_no?: string | null;
      agenda_title?: string | null;
      text?: string;
      resolution_type?: string;
      required_threshold?: string | null;
      pass_rule?: { label?: string } | null;
      outcome?: "decided" | "not_decided" | "informational" | null;
      passed_choice_ids?: string[] | null;
      requires_land_office_registration?: boolean;
      legal_note?: string | null;
      choices?: {
        id?: string;
        text?: string;
        is_abstain?: boolean;
        meets_rule?: boolean;
        vote_count?: number;
        ownership?: number;
        percent_of_total_ownership?: number;
        percent_of_submitted_ownership?: number;
      }[];
    }[];
    totals?: {
      quorum?: { label?: string; met?: boolean | null } | null;
      eligible_voters?: number;
      submitted_ballots?: number;
      online_ballots?: number;
      manual_ballots?: number;
      total_eligible_ownership?: number;
      submitted_ownership?: number;
      source_conflicts?: number;
      resolved_source_conflicts?: number;
    };
    vote_source_audit?: {
      conflicts?: {
        chosen_source?: string | null;
        conflict_remark?: string | null;
        resolved_at?: string | null;
      }[];
    };
  };
}

export function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}
