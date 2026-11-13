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
    /** English text (item 6b); older snapshots have none. */
    title_en?: string | null;
    location_en?: string | null;
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
    agenda_title_en?: string | null;
    text?: string;
    text_en?: string | null;
    resolution_type?: string;
    legal_note?: string | null;
    requires_land_office_registration?: boolean | null;
    pass_rule?: { label?: string; basis?: string; operator?: string; percent?: number } | null;
    outcome?: "decided" | "not_decided" | "informational" | null;
    passed_choice_ids?: string[] | null;
    choices?: {
      id?: string;
      text?: string;
      text_en?: string | null;
      is_abstain?: boolean;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A published result in the history and the archive (light: no payload). */
export type SummaryListItem = {
  id: string;
  meetingId: string;
  title: string | null;
  meetingStartsAt: string | null;
  fiscalYear: string | null;
  publishedAt: string;
};

type ListRow = {
  id: string;
  meeting_id: string;
  published_at: string;
  result_snapshots:
    | { title: string | null; starts_at: string | null; fiscal_year: string | null }
    | { title: string | null; starts_at: string | null; fiscal_year: string | null }[]
    | null;
};

function time(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Every published result, newest meeting first (demo feedback item 8:
 * before, the history followed publication time, so a result approved late
 * jumped above newer meetings). Meeting facts come from the snapshot, which
 * every approved member can read. */
export async function getSummaryList(): Promise<SummaryListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("result_publications")
    .select(
      "id, meeting_id, published_at, result_snapshots(title:payload_json->meeting->>title, starts_at:payload_json->meeting->>starts_at, fiscal_year:payload_json->meeting->>fiscal_year)",
    );

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ListRow[])
    .map((row) => {
      const snapshot = Array.isArray(row.result_snapshots)
        ? row.result_snapshots[0]
        : row.result_snapshots;

      return {
        id: row.id,
        meetingId: row.meeting_id,
        title: snapshot?.title ?? null,
        meetingStartsAt: snapshot?.starts_at ?? null,
        fiscalYear: snapshot?.fiscal_year ?? null,
        publishedAt: row.published_at,
      };
    })
    .sort(
      (a, b) =>
        time(b.meetingStartsAt ?? b.publishedAt) - time(a.meetingStartsAt ?? a.publishedAt) ||
        time(b.publishedAt) - time(a.publishedAt),
    );
}

async function getCondoProfile() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condo_profiles")
    .select("project_name, juristic_name, document_footer, summary_history_limit, project_name_en, juristic_name_en")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getPublishedSummary(meetingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("result_publications")
    .select(
      "id, meeting_id, approved_at:published_at, result_snapshots(id, generated_at, payload_json, payload_sha256, result_documents(kind, language))",
    )
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeApproval({ ...data, notes: null }) : null;
}

/**
 * The summary page: one result in full, plus the history side panel.
 * Without a meeting, the newest meeting's result. The panel shows the
 * latest `summary_history_limit` results (Admin > Setup, 1–20); the shown
 * result stays in the panel even when it is older than those.
 */
export async function getSummaryData(meetingId?: string) {
  await requireProfile();

  const [condoProfile, list] = await Promise.all([getCondoProfile(), getSummaryList()]);
  const historyLimit = Math.max(
    1,
    Math.min(Number(condoProfile?.summary_history_limit ?? 5), 20),
  );
  const targetMeetingId = meetingId
    ? UUID.test(meetingId)
      ? meetingId
      : undefined
    : list[0]?.meetingId;
  const selected = targetMeetingId ? await getPublishedSummary(targetMeetingId) : null;
  const latest = list.slice(0, historyLimit);
  const selectedItem = selected
    ? list.find((item) => item.meetingId === selected.meetingId)
    : undefined;
  const history =
    selectedItem && !latest.some((item) => item.id === selectedItem.id)
      ? [selectedItem, ...latest]
      : latest;

  return {
    condoProfile,
    historyLimit,
    history,
    totalCount: list.length,
    selected,
  };
}
