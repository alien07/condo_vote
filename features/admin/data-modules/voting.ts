import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchVotingData(supabase: SupabaseServerClient) {
  const [
    manualBallotsResult,
    voteSourceResolutionsResult,
    ballotsResult,
    proxyAuthorizationsResult,
    eligibleVotersResult,
  ] = await Promise.all([
    supabase
      .from("manual_ballots")
      .select(
        "id, meeting_id, room_id, source_label, audit_note, status, imported_at, meetings(id, title), rooms(id, room_number), manual_ballot_answers(id, question_id, choice_id, meeting_questions(id, question_text), meeting_choices(id, choice_text))",
      )
      .order("imported_at", { ascending: false }),
    supabase
      .from("vote_source_resolutions")
      .select(
        "id, meeting_id, room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at, meetings(id, title), rooms(id, room_number)",
      )
      .order("resolved_at", { ascending: false }),
    supabase
      .from("ballots")
      .select("id, meeting_id, room_id, status")
      .eq("status", "submitted"),
    supabase
      .from("proxy_authorizations")
      .select(
        "id, status, valid_from, valid_until, meetings(id, title), rooms(id, room_number), owners(id, full_name), profiles!proxy_authorizations_proxy_profile_id_fkey(id, full_name, email)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("eligible_voters_snapshot")
      .select("id, meeting_id, room_id, profile_id, voter_type, source"),
  ]);

  if (manualBallotsResult.error) {
    throw manualBallotsResult.error;
  }

  if (voteSourceResolutionsResult.error) {
    throw voteSourceResolutionsResult.error;
  }

  if (ballotsResult.error) {
    throw ballotsResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  if (eligibleVotersResult.error) {
    throw eligibleVotersResult.error;
  }

  return {
    manualBallots: manualBallotsResult.data,
    voteSourceResolutions: voteSourceResolutionsResult.data,
    ballots: ballotsResult.data,
    proxyAuthorizations: proxyAuthorizationsResult.data,
    eligibleVoters: eligibleVotersResult.data,
  };
}
