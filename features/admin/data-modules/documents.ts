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

export type DocumentTableFilters = {
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
  set?: string;
  sortBy?: "created" | "set" | "type";
  type?: string;
};

export async function fetchAuditLogRows(
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

  const auditLogsResult = await auditLogsQuery
    .order(auditSortColumn, { ascending: auditSortAscending })
    .range(auditRangeFrom, auditRangeTo);

  if (auditLogsResult.error) {
    throw auditLogsResult.error;
  }

  return {
    auditLogs: auditLogsResult.data,
    auditLogPage: auditPage,
    auditLogPerPage: auditPerPage,
    auditLogTotal: auditLogsResult.count ?? 0,
  };
}

export async function fetchDocumentRows(
  supabase: SupabaseServerClient,
  documentFilters: DocumentTableFilters = {},
) {
  const sortColumn =
    documentFilters.sortBy === "set"
      ? "document_set_key"
      : documentFilters.sortBy === "type"
        ? "document_type"
        : "created_at";
  const sortAscending = documentFilters.dir === "asc";
  const page = Math.max(1, documentFilters.page ?? 1);
  const perPage = Math.min(Math.max(documentFilters.perPage ?? 25, 10), 100);
  const rangeFrom = (page - 1) * perPage;
  const rangeTo = rangeFrom + perPage - 1;
  let query = supabase
    .from("documents")
    .select(
      "id, owner_type, owner_id, document_type, storage_provider, storage_path, document_set_key, document_version, original_filename, mime_type, file_size_bytes, checksum_sha256, created_at",
      { count: "exact" },
    );

  if (documentFilters.set) {
    query = query.ilike("document_set_key", `%${documentFilters.set}%`);
  }

  if (documentFilters.type && documentFilters.type !== "all") {
    query = query.eq("document_type", documentFilters.type);
  }

  const result = await query
    .order(sortColumn, { ascending: sortAscending })
    .range(rangeFrom, rangeTo);

  if (result.error) {
    throw result.error;
  }

  return {
    documentPage: page,
    documentPerPage: perPage,
    documentTotal: result.count ?? 0,
    documents: result.data,
  };
}

export async function fetchDocumentData(
  supabase: SupabaseServerClient,
  auditFilters: AuditLogFilters = {},
) {
  const auditRows = fetchAuditLogRows(supabase, auditFilters);

  const [settingsResult, documentsResult, auditLogsResult, auditOptionsResult] =
    await Promise.all([
    supabase
      .from("app_settings")
      .select("id, document_storage_provider, document_storage_root")
      .order("created_at", { ascending: false })
      .limit(1),
    fetchDocumentRows(supabase),
    auditRows,
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

  if (auditOptionsResult.error) {
    throw auditOptionsResult.error;
  }

  return {
    appSettings: settingsResult.data[0] ?? null,
    auditLogs: auditLogsResult.auditLogs,
    auditLogPage: auditLogsResult.auditLogPage,
    auditLogPerPage: auditLogsResult.auditLogPerPage,
    auditLogTotal: auditLogsResult.auditLogTotal,
    auditOptions: auditOptionsResult.data,
    documents: documentsResult.documents,
  };
}
