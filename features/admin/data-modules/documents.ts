import { bangkokLocalToIso } from "@/lib/datetime";
import { auditMeetingFilter } from "@/features/admin/data-modules/audit-meeting";
import type { createClient } from "@/lib/supabase/server";
import {
  documentOwnersFor,
  ownerKey,
  resolveDocumentOwners,
  type DocumentOwner,
} from "@/features/admin/data-modules/document-owners";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuditLogFilters = {
  actions?: string[];
  actorProfileId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Meeting id (audit page, req_0007): rows about that meeting only. */
  meetingId?: string;
  page?: number;
  perPage?: number;
  sortBy?: "action" | "actor" | "entity" | "time";
  sortDirection?: "asc" | "desc";
};

export type DocumentTableFilters = {
  dir?: "asc" | "desc";
  /** Owner of record id (owners.id): their account's documents and their proxies. */
  owner?: string;
  page?: number;
  perPage?: number;
  /** Room id: documents of its owners, proxies and approval requests. */
  room?: string;
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

  // Filter inputs are Bangkok time; the column is UTC.
  const auditFrom = bangkokLocalToIso(auditFilters.dateFrom);
  const auditTo = bangkokLocalToIso(auditFilters.dateTo);

  if (auditFrom) {
    auditLogsQuery = auditLogsQuery.gte("created_at", auditFrom);
  }

  if (auditTo) {
    auditLogsQuery = auditLogsQuery.lte("created_at", auditTo);
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

  if (auditFilters.meetingId) {
    const meetingFilter = await auditMeetingFilter(supabase, auditFilters.meetingId);

    if (!meetingFilter) {
      return { auditLogs: [], auditLogPage: 1, auditLogPerPage: auditPerPage, auditLogTotal: 0 };
    }

    auditLogsQuery = auditLogsQuery.or(meetingFilter);
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

const DOCUMENT_COLUMNS =
  "id, owner_type, owner_id, document_type, storage_provider, storage_path, document_set_key, document_version, original_filename, mime_type, file_size_bytes, checksum_sha256, created_at, uploader:profiles!documents_uploaded_by_fkey(full_name, email)";

type DocumentWithUploader = {
  owner_type: string;
  owner_id: string;
  uploader: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
};

/** Rows with whose document it is and who registered it, in words. */
async function withOwners<T extends DocumentWithUploader>(supabase: SupabaseServerClient, rows: T[]) {
  const owners = await resolveDocumentOwners(supabase, rows);

  return rows.map(({ uploader, ...row }) => {
    const person = Array.isArray(uploader) ? uploader[0] : uploader;

    return {
      ...row,
      owner: owners.get(ownerKey(row)) ?? (null as DocumentOwner | null),
      uploaded_by_name: person?.full_name ?? person?.email ?? null,
    };
  });
}

/** One document for the details drawer and "Register new version". */
export async function fetchDocumentById(supabase: SupabaseServerClient, id: string) {
  const { data, error } = await supabase.from("documents").select(DOCUMENT_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (await withOwners(supabase, [data]))[0] : null;
}

export type DocumentRecord = NonNullable<Awaited<ReturnType<typeof fetchDocumentById>>>;

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
    .select(DOCUMENT_COLUMNS, { count: "exact" });
  const ownerRefs = await documentOwnersFor(supabase, {
    ownerId: documentFilters.owner,
    roomId: documentFilters.room,
  });

  if (ownerRefs && ownerRefs.length === 0) {
    return { documentPage: page, documentPerPage: perPage, documentTotal: 0, documents: [] };
  }

  if (ownerRefs) {
    // Ids are uuids from the database, safe inside the filter text.
    const byType = new Map<string, string[]>();

    ownerRefs.forEach((ref) => byType.set(ref.owner_type, [...(byType.get(ref.owner_type) ?? []), ref.owner_id]));
    query = query.or(
      [...byType.entries()]
        .map(([type, ids]) => `and(owner_type.eq.${type},owner_id.in.(${ids.join(",")}))`)
        .join(","),
    );
  }

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
    documents: await withOwners(supabase, result.data),
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
