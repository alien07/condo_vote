import { bangkokLocalToIso } from "@/lib/datetime";
import type { createClient } from "@/lib/supabase/server";
import { auditMeetingFilter } from "@/features/admin/data-modules/audit-meeting";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const AUDIT_TABS = ["results", "corrections", "log"] as const;
export type AuditTab = (typeof AUDIT_TABS)[number];

/** Filters of one tab of the audit page (req_0007), from the URL. */
export type AuditListFilters = {
  /** Meeting id (`?meeting=`), shared by all tabs. */
  meeting: string;
  /** Dates "YYYY-MM-DD", Bangkok days, both included. */
  from: string;
  to: string;
  page: number;
  perPage: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function auditTabFromParam(value: string | undefined): AuditTab {
  return AUDIT_TABS.find((tab) => tab === value) ?? "results";
}

export function auditListFilters(params: Record<string, string | undefined>): AuditListFilters {
  return {
    meeting: params.meeting && UUID.test(params.meeting) ? params.meeting : "",
    from: params.from && DATE.test(params.from) ? params.from : "",
    to: params.to && DATE.test(params.to) ? params.to : "",
    page: positiveInteger(params.page, 1),
    perPage: Math.min(Math.max(positiveInteger(params.perPage, 25), 10), 100),
  };
}

/** The start of a Bangkok day, and the start of the next one (exclusive end). */
export function bangkokDayRange(from: string, to: string) {
  const next = (date: string) => {
    const day = new Date(`${date}T00:00:00Z`);

    day.setUTCDate(day.getUTCDate() + 1);
    return day.toISOString().slice(0, 10);
  };

  return {
    start: from ? bangkokLocalToIso(`${from}T00:00`) : null,
    end: to ? bangkokLocalToIso(`${next(to)}T00:00`) : null,
  };
}

function pageRange(filters: AuditListFilters) {
  const start = (filters.page - 1) * filters.perPage;

  return [start, start + filters.perPage - 1] as const;
}

/** Published results, newest first, with whether the official PDF exists. */
export async function fetchAuditPublications(supabase: SupabaseServerClient, filters: AuditListFilters) {
  const { start, end } = bangkokDayRange(filters.from, filters.to);
  let query = supabase
    .from("result_publications")
    .select("id, published_at, approvals_count, result_snapshot_id, meeting_id, meetings(title)", { count: "exact" });

  if (filters.meeting) query = query.eq("meeting_id", filters.meeting);
  if (start) query = query.gte("published_at", start);
  if (end) query = query.lt("published_at", end);

  const { data, count, error } = await query.order("published_at", { ascending: false }).range(...pageRange(filters));

  if (error) {
    throw error;
  }

  const snapshotIds = (data ?? []).map((row) => row.result_snapshot_id);
  const official = new Set<string>();

  if (snapshotIds.length) {
    const { data: files, error: filesError } = await supabase
      .from("result_documents")
      .select("result_snapshot_id")
      .eq("kind", "official")
      .in("result_snapshot_id", snapshotIds);

    if (filesError) {
      throw filesError;
    }

    for (const file of files ?? []) {
      official.add(file.result_snapshot_id);
    }
  }

  return {
    rows: (data ?? []).map((row) => ({ ...row, hasOfficialPdf: official.has(row.result_snapshot_id) })),
    total: count ?? 0,
  };
}

/** Correction requests, newest first, with who asked. */
export async function fetchAuditCorrections(supabase: SupabaseServerClient, filters: AuditListFilters) {
  const { start, end } = bangkokDayRange(filters.from, filters.to);
  let query = supabase
    .from("result_correction_requests")
    .select(
      "id, category, level, status, reason, answer, created_at, answered_at, meeting_id, meetings(title), requester:profiles!result_correction_requests_requested_by_fkey(full_name, email)",
      { count: "exact" },
    );

  if (filters.meeting) query = query.eq("meeting_id", filters.meeting);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);

  const { data, count, error } = await query.order("created_at", { ascending: false }).range(...pageRange(filters));

  if (error) {
    throw error;
  }

  return { rows: data ?? [], total: count ?? 0 };
}

/** How many rows each tab has for the chosen meeting (no date filter). */
export async function fetchAuditTabCounts(supabase: SupabaseServerClient, meeting: string) {
  const publications = supabase.from("result_publications").select("id", { count: "exact", head: true });
  const corrections = supabase.from("result_correction_requests").select("id", { count: "exact", head: true });
  let logs = supabase.from("audit_logs").select("id", { count: "exact", head: true });

  if (meeting) {
    const meetingFilter = await auditMeetingFilter(supabase, meeting);

    if (meetingFilter) {
      logs = logs.or(meetingFilter);
    }
  }

  const [publicationCount, correctionCount, logCount] = await Promise.all([
    meeting ? publications.eq("meeting_id", meeting) : publications,
    meeting ? corrections.eq("meeting_id", meeting) : corrections,
    logs,
  ]);

  for (const result of [publicationCount, correctionCount, logCount]) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    results: publicationCount.count ?? 0,
    corrections: correctionCount.count ?? 0,
    log: logCount.count ?? 0,
  };
}
