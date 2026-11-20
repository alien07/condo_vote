// Temporary read-only access and system admins (req_0011 B, D027). Rules
// live in supabase/migrations/0048; these wrappers call them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type SystemAccessEntry = {
  id: string;
  name: string | null;
  reason: string;
  starts_at: string;
  ends_at: string;
  mine: boolean;
};

export type SystemAccessStatus = { mine: boolean; active: SystemAccessEntry[] };

export type SystemAdmin = {
  profile_id: string;
  name: string | null;
  email: string | null;
  me: boolean;
  building_roles: string[];
};

export class SystemError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SystemError";
  }
}

function toSystemError(error: { message: string }) {
  const match = error.message.match(/^(SYSTEM_[A-Z_]+):\s*([\s\S]*)$/);

  return match ? new SystemError(match[1], match[2]) : new SystemError("SYSTEM_UNKNOWN", error.message);
}

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) {
    throw toSystemError(error);
  }

  return data as T;
}

/** Records expiries, then who has access now. Null when not allowed. */
export async function getSystemAccessStatus(supabase: Client): Promise<SystemAccessStatus | null> {
  const { data, error } = await supabase.rpc("system_access_status");

  return error ? null : (data as unknown as SystemAccessStatus);
}

export const ACCESS_HOURS = [1, 4, 24] as const;

export async function startSystemAccess(supabase: Client, input: { reason: string; hours: number }) {
  return unwrap<{ id: string; ends_at: string }>(
    await supabase.rpc("start_system_read_access", { p_reason: input.reason, p_hours: input.hours }),
  );
}

export async function endSystemAccess(supabase: Client) {
  return unwrap<null>(await supabase.rpc("end_system_read_access"));
}

export async function listSystemAdmins(supabase: Client) {
  return unwrap<SystemAdmin[]>(await supabase.rpc("system_admin_list"));
}

export async function grantSystemAdmin(supabase: Client, email: string) {
  return unwrap<{ profile_id: string; building_roles: string[] }>(
    await supabase.rpc("grant_system_admin", { p_email: email }),
  );
}

export async function revokeSystemAdmin(supabase: Client, profileId: string) {
  return unwrap<null>(await supabase.rpc("revoke_system_admin", { p_profile_id: profileId }));
}
