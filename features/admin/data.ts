import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function getAdminDashboardData() {
  await requireAdmin();

  const supabase = await createClient();
  const [
    roomsResult,
    ownersResult,
    roomOwnersResult,
    meetingsResult,
    questionsResult,
    proxyAuthorizationsResult,
    eligibleVotersResult,
    resultSnapshotsResult,
    committeeApprovalsResult,
    emailLogsResult,
    profilesResult,
  ] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(
          "id, room_number, floor, building, area_size, ownership_percent, active",
        )
        .order("room_number", { ascending: true }),
      supabase
        .from("owners")
        .select("id, full_name, email, phone, line_id, active")
        .order("created_at", { ascending: false }),
      supabase
        .from("room_owners")
        .select(
          "id, ownership_role, starts_at, ends_at, rooms(id, room_number), owners(id, full_name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("id, title, description, starts_at, ends_at, status")
        .order("starts_at", { ascending: false }),
      supabase
        .from("meeting_questions")
        .select(
          "id, meeting_id, question_text, question_type, display_order, required, meetings(id, title), meeting_choices(id, choice_text, display_order)",
        )
        .order("display_order", { ascending: true }),
      supabase
        .from("proxy_authorizations")
        .select(
          "id, status, valid_from, valid_until, meetings(id, title), rooms(id, room_number), owners(id, full_name), profiles!proxy_authorizations_proxy_profile_id_fkey(id, full_name, email)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("eligible_voters_snapshot")
        .select("id, meeting_id, room_id, profile_id, voter_type, source"),
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
        .from("email_logs")
        .select(
          "id, recipient_email, template_key, status, sent_at, error_message, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, default_status, approval_status, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (meetingsResult.error) {
    throw meetingsResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  if (eligibleVotersResult.error) {
    throw eligibleVotersResult.error;
  }

  if (resultSnapshotsResult.error) {
    throw resultSnapshotsResult.error;
  }

  if (committeeApprovalsResult.error) {
    throw committeeApprovalsResult.error;
  }

  if (emailLogsResult.error) {
    throw emailLogsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  return {
    rooms: roomsResult.data,
    owners: ownersResult.data,
    roomOwners: roomOwnersResult.data,
    meetings: meetingsResult.data,
    questions: questionsResult.data,
    proxyAuthorizations: proxyAuthorizationsResult.data,
    eligibleVoters: eligibleVotersResult.data,
    resultSnapshots: resultSnapshotsResult.data,
    committeeApprovals: committeeApprovalsResult.data,
    emailLogs: emailLogsResult.data,
    profiles: profilesResult.data,
  };
}
