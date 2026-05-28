import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchSetupData(supabase: SupabaseServerClient) {
  const [condoProfilesResult, committeeMembersResult] = await Promise.all([
    supabase
      .from("condo_profiles")
      .select(
        "id, juristic_name, project_name, registration_no, tax_id, address, phone, email, manager_name, document_footer, summary_history_limit",
      )
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("committee_members")
      .select(
        "id, profile_id, full_name, position_title, term_starts_at, term_ends_at, display_order, active",
      )
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (condoProfilesResult.error) {
    throw condoProfilesResult.error;
  }

  if (committeeMembersResult.error) {
    throw committeeMembersResult.error;
  }

  return {
    condoProfile: condoProfilesResult.data[0] ?? null,
    committeeMembers: committeeMembersResult.data,
  };
}
