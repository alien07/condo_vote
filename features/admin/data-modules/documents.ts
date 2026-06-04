import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuditLogFilters = {
  actions?: string[];
  actorProfileId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
  sortBy?: "action" | "actor" | "entity" | "time";
  sortDirection?: "asc" | "desc";
};

export async function fetchDocumentData(
  supabase: SupabaseServerClient,
  auditFilters: AuditLogFilters = {},
) {
  const auditSortColumn =
    auditFilters.sortBy === "action"
      ? "action"
      : auditFilters.sortBy === "actor"
        ? "actor_profile_id"
        : auditFilters.sortBy === "entity"
          ? "entity_type"
          : "created_at";
  const auditSortAscending = auditFilters.sortDirection === "asc";
  const auditPage = Math.max(1, auditFilters.page ?? 1);
  const auditPerPage = Math.min(Math.max(auditFilters.perPage ?? 25, 10), 100);
  const auditRangeFrom = (auditPage - 1) * auditPerPage;
  const auditRangeTo = auditRangeFrom + auditPerPage - 1;
  let auditLogsQuery = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, details_json, created_at, profiles!audit_logs_actor_profile_id_fkey(id, full_name, email)",
      { count: "exact" },
    );

  if (auditFilters.dateFrom) {
    auditLogsQuery = auditLogsQuery.gte("created_at", auditFilters.dateFrom);
  }

  if (auditFilters.dateTo) {
    auditLogsQuery = auditLogsQuery.lte("created_at", auditFilters.dateTo);
  }

  if (auditFilters.actorProfileId) {
    auditLogsQuery = auditLogsQuery.eq(
      "actor_profile_id",
      auditFilters.actorProfileId,
    );
  }

  if (auditFilters.actions && auditFilters.actions.length > 0) {
    auditLogsQuery = auditLogsQuery.in("action", auditFilters.actions);
  }

  const [settingsResult, documentsResult, auditLogsResult, auditOptionsResult] =
    await Promise.all([
    supabase
      .from("app_settings")
      .select("id, document_storage_provider, document_storage_root")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("documents")
      .select(
        "id, owner_type, owner_id, document_type, storage_provider, storage_path, document_set_key, document_version, original_filename, mime_type, file_size_bytes, checksum_sha256, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    auditLogsQuery
      .order(auditSortColumn, { ascending: auditSortAscending })
      .range(auditRangeFrom, auditRangeTo),
    supabase
      .from("audit_logs")
      .select(
        "action, profiles!audit_logs_actor_profile_id_fkey(id, full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (settingsResult.error) {
    throw settingsResult.error;
  }

  if (documentsResult.error) {
    throw documentsResult.error;
  }

  if (auditLogsResult.error) {
    throw auditLogsResult.error;
  }

  if (auditOptionsResult.error) {
    throw auditOptionsResult.error;
  }

  return {
    appSettings: settingsResult.data[0] ?? null,
    auditLogs: auditLogsResult.data,
    auditLogPage: auditPage,
    auditLogPerPage: auditPerPage,
    auditLogTotal: auditLogsResult.count ?? 0,
    auditOptions: auditOptionsResult.data,
    documents: documentsResult.data,
  };
}
