import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type AuditInput = {
  action: string;
  actorProfileId: string;
  details?: Record<string, Json | undefined>;
  entityId?: string | null;
  entityType: string;
};

export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  input: AuditInput,
) {
  const details = Object.fromEntries(
    Object.entries(input.details ?? {}).filter((entry) => entry[1] !== undefined),
  ) as Record<string, Json>;
  const { error } = await supabase.from("audit_logs").insert({
    action: input.action,
    actor_profile_id: input.actorProfileId,
    details_json: details,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
  });

  if (error) {
    throw error;
  }
}
