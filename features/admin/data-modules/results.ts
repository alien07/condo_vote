import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchResultsData(supabase: SupabaseServerClient) {
  const [
    resultSnapshotsResult,
    committeeApprovalsResult,
    pendingManualBallotsResult,
  ] = await Promise.all([
    supabase
      .from("result_snapshots")
      .select("id, meeting_id, generated_at, payload_json, meetings(id, title)")
      .order("generated_at", { ascending: false }),
    supabase
      .from("committee_approvals")
      .select(
        "id, meeting_id, result_snapshot_id, approved_at, notes, profiles!committee_approvals_approved_by_fkey(id, full_name, email)",
      )
      .order("approved_at", { ascending: false }),
    supabase
      .from("manual_ballots")
      .select("id, meeting_id, room_id, identity_status, status, rooms(id, room_number)")
      .or("identity_status.eq.pending,status.eq.draft")
      .order("imported_at", { ascending: false }),
  ]);

  if (resultSnapshotsResult.error) {
    throw resultSnapshotsResult.error;
  }

  if (committeeApprovalsResult.error) {
    throw committeeApprovalsResult.error;
  }

  if (pendingManualBallotsResult.error) {
    throw pendingManualBallotsResult.error;
  }

  return {
    resultSnapshots: resultSnapshotsResult.data,
    committeeApprovals: committeeApprovalsResult.data,
    pendingManualBallots: pendingManualBallotsResult.data,
  };
}
