import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchDocumentData(supabase: SupabaseServerClient) {
  const [settingsResult, documentsResult, auditLogsResult] = await Promise.all([
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
    supabase
      .from("audit_logs")
      .select(
        "id, action, entity_type, entity_id, details_json, created_at, profiles!audit_logs_actor_profile_id_fkey(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
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

  return {
    appSettings: settingsResult.data[0] ?? null,
    auditLogs: auditLogsResult.data,
    documents: documentsResult.data,
  };
}
