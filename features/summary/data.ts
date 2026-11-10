import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

// Result snapshot payload, as written by result generation. Older snapshots
// lack the record fields (condo, incidents, notice date...).
export type SummaryPayload = {
  generated_at?: string;
  condo?: {
    project_name?: string;
    juristic_name?: string;
    registration_no?: string | null;
    tax_id?: string | null;
    address?: string | null;
    manager_name?: string | null;
  } | null;
  meeting?: {
    title?: string;
    meeting_number?: string | null;
    meeting_type?: string | null;
    fiscal_year?: string | null;
    location?: string | null;
    starts_at?: string;
    ends_at?: string;
    chairperson_name?: string | null;
    ballot_secrecy?: string | null;
    advance_starts_at?: string | null;
    advance_ends_at?: string | null;
    notice_sent_at?: string | null;
    meeting_round?: string | null;
    identity_method?: string | null;
    recording_reference?: string | null;
    traffic_log_reference?: string | null;
  };
  incidents?: {
    started_at: string;
    ended_at: string | null;
    description: string;
    action_taken: string | null;
  }[];
  questions?: {
    agenda_no?: string | null;
    agenda_title?: string | null;
    text?: string;
    resolution_type?: string;
    legal_note?: string | null;
    requires_land_office_registration?: boolean | null;
    pass_rule?: { label?: string; basis?: string; operator?: string; percent?: number } | null;
    outcome?: "decided" | "not_decided" | "informational" | null;
    passed_choice_ids?: string[] | null;
    choices?: {
      id?: string;
      text?: string;
      vote_count?: number;
      ownership?: number;
      percent_of_submitted_ownership?: number;
      percent_of_total_ownership?: number;
    }[];
  }[];
  totals?: {
    quorum?: { label?: string; required_percent?: number | null; met?: boolean | null } | null;
    proxy_rooms?: number;
    advance_online_ballots?: number;
    meeting_day_online_ballots?: number;
    effective_manual_ballots?: number;
    online_ballots?: number;
    manual_ballots?: number;
    eligible_voters?: number;
    submitted_ballots?: number;
    total_eligible_ownership?: number;
    submitted_ownership?: number;
    source_conflicts?: number;
    resolved_source_conflicts?: number;
  };
  vote_source_audit?: {
    conflicts?: {
      chosen_source?: string | null;
      conflict_remark?: string | null;
    }[];
  };
};

export type ApprovedSummary = {
  id: string;
  meetingId: string;
  approvedAt: string;
  notes: string | null;
  snapshotId: string;
  generatedAt: string;
  payloadSha256: string | null;
  /** Master PDF files of this result (D021), as "summary-th" and so on. */
  pdfFiles: string[];
  payload: SummaryPayload;
};

function normalizePayload(payload: unknown): SummaryPayload {
  return payload && typeof payload === "object" ? (payload as SummaryPayload) : {};
}

function normalizeApproval(row: {
  id: string;
  meeting_id: string;
  approved_at: string;
  notes: string | null;
  result_snapshots:
    | {
        id: string;
        generated_at: string;
        payload_json: unknown;
        payload_sha256: string | null;
        result_documents?: { kind: string; language: string }[] | null;
      }
    | {
        id: string;
        generated_at: string;
        payload_json: unknown;
        payload_sha256: string | null;
        result_documents?: { kind: string; language: string }[] | null;
      }[]
    | null;
}): ApprovedSummary | null {
  const snapshot = Array.isArray(row.result_snapshots)
    ? row.result_snapshots[0]
    : row.result_snapshots;

  if (!snapshot) {
    return null;
  }

  return {
    id: row.id,
    meetingId: row.meeting_id,
    approvedAt: row.approved_at,
    notes: row.notes,
    snapshotId: snapshot.id,
    generatedAt: snapshot.generated_at,
    payloadSha256: snapshot.payload_sha256,
    pdfFiles: (snapshot.result_documents ?? []).map((file) => `${file.kind}-${file.language}`),
    payload: normalizePayload(snapshot.payload_json),
  };
}

export async function getSummaryData(meetingId?: string) {
  await requireProfile();

  const supabase = await createClient();
  const { data: condoProfile, error: condoProfileError } = await supabase
    .from("condo_profiles")
    .select("project_name, juristic_name, document_footer, summary_history_limit")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (condoProfileError) {
    throw condoProfileError;
  }

  const historyLimit = Math.max(
    1,
    Math.min(Number(condoProfile?.summary_history_limit ?? 5), 20),
  );
  // D014: a result is visible once approvals reach the minimum, which is
  // recorded in result_publications.
  let query = supabase
    .from("result_publications")
    .select(
      "id, meeting_id, approved_at:published_at, result_snapshots(id, generated_at, payload_json, payload_sha256, result_documents(kind, language))",
    )
    .order("published_at", { ascending: false })
    .limit(historyLimit);

  if (meetingId) {
    query = query.eq("meeting_id", meetingId).limit(1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const summaries = data
    .map((row) => normalizeApproval({ ...row, notes: null }))
    .filter((summary): summary is ApprovedSummary => Boolean(summary));

  return {
    condoProfile,
    historyLimit,
    summaries,
  };
}
