import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";

export function deriveSharedAdminState({
  appRoles,
  committeeApprovals,
  pendingManualBallots,
  profiles,
  resultDecisions,
  resultPublications,
}: Pick<
  AdminDashboardData,
  | "appRoles"
  | "committeeApprovals"
  | "pendingManualBallots"
  | "profiles"
  | "resultDecisions"
  | "resultPublications"
>) {
  // D014: "approved" means published, i.e. approvals reached the minimum.
  const approvedResultSnapshotIds = new Set(
    resultPublications.map((publication) => publication.result_snapshot_id),
  );
  // Any approval locks the meeting's results: no new snapshots, unless the
  // committee did not pass the latest one (D027, 0046).
  const notPassedMeetingIds = new Set(
    resultDecisions.filter((decision) => decision.status === "not_passed").map((decision) => decision.meeting_id),
  );
  const lockedMeetingIds = new Set(
    committeeApprovals
      .map((approval) => approval.meeting_id)
      .filter((meetingId) => !notPassedMeetingIds.has(meetingId)),
  );
  // Published on the chair's deciding vote (D027).
  const castingDecidedSnapshotIds = new Set(
    resultPublications
      .filter((publication) => publication.decided_by_casting_vote)
      .map((publication) => publication.result_snapshot_id),
  );
  const decisionBySnapshotId = new Map(resultDecisions.map((decision) => [decision.subject_id, decision]));
  const approvalCountBySnapshotId = new Map<string, number>();

  for (const approval of committeeApprovals) {
    approvalCountBySnapshotId.set(
      approval.result_snapshot_id,
      (approvalCountBySnapshotId.get(approval.result_snapshot_id) ?? 0) + 1,
    );
  }
  const approvedMeetingIds = new Set(
    resultPublications.map((publication) => publication.meeting_id),
  );
  const pendingManualBallotsByMeetingId = new Map<
    string,
    typeof pendingManualBallots
  >();
  for (const ballot of pendingManualBallots) {
    const current = pendingManualBallotsByMeetingId.get(ballot.meeting_id) ?? [];

    pendingManualBallotsByMeetingId.set(ballot.meeting_id, [...current, ballot]);
  }
  const appRolesByProfile = new Map(
    profiles.map((profile) => [
      profile.id,
      appRoles.filter((role) => role.profile_id === profile.id),
    ]),
  );

  return {
    appRolesByProfile,
    approvalCountBySnapshotId,
    castingDecidedSnapshotIds,
    decisionBySnapshotId,
    lockedMeetingIds,
    approvedMeetingIds,
    approvedResultSnapshotIds,
    pendingManualBallotsByMeetingId,
  };
}

export type SharedAdminState = ReturnType<typeof deriveSharedAdminState>;
