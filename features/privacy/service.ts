import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PrivacySettings = {
  consent_required: boolean;
  notice_text: string;
  /** English notice; empty means the Thai notice is shown (D020). */
  notice_text_en: string | null;
  notice_version: number;
  retention_months_inactive_profiles: number;
  retention_months_vote_records: number;
  updated_at: string;
};

// PDPA privacy notice and retention settings (D016).
export async function getPrivacySettings(
  supabase: SupabaseServerClient,
): Promise<PrivacySettings | null> {
  const { data, error } = await supabase
    .from("privacy_settings")
    .select(
      "consent_required, notice_text, notice_text_en, notice_version, retention_months_inactive_profiles, retention_months_vote_records, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// True when the signed-in user still has to accept the current notice.
export async function needsPrivacyConsent(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.rpc("needs_privacy_consent");

  if (error) {
    throw error;
  }

  return Boolean(data);
}
