import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type SummaryPayload = {
  generated_at?: string;
  meeting?: {
    title?: string;
    meeting_number?: string | null;
    fiscal_year?: string | null;
    location?: string | null;
    starts_at?: string;
    ends_at?: string;
    chairperson_name?: string | null;
  };
  questions?: {
    agenda_no?: string | null;
    agenda_title?: string | null;
    text?: string;
    resolution_type?: string;
    choices?: {
      text?: string;
      vote_count?: number;
      ownership?: number;
      percent_of_submitted_ownership?: number;
      percent_of_total_ownership?: number;
    }[];
  }[];
  totals?: {
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
      }
    | {
        id: string;
        generated_at: string;
        payload_json: unknown;
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
  let query = supabase
    .from("committee_approvals")
    .select(
      "id, meeting_id, approved_at, notes, result_snapshots(id, generated_at, payload_json)",
    )
    .order("approved_at", { ascending: false })
    .limit(historyLimit);

  if (meetingId) {
    query = query.eq("meeting_id", meetingId).limit(1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const summaries = data
    .map((row) => normalizeApproval(row))
    .filter((summary): summary is ApprovedSummary => Boolean(summary));

  return {
    condoProfile,
    historyLimit,
    summaries,
  };
}
