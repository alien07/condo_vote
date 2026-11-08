import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";

export function deriveSharedAdminState({
  appRoles,
  committeeApprovals,
  pendingManualBallots,
  profiles,
  resultPublications,
}: Pick<
  AdminDashboardData,
  | "appRoles"
  | "committeeApprovals"
  | "pendingManualBallots"
  | "profiles"
  | "resultPublications"
>) {
  // D014: "approved" means published, i.e. approvals reached the minimum.
  const approvedResultSnapshotIds = new Set(
    resultPublications.map((publication) => publication.result_snapshot_id),
  );
  // Any approval locks the meeting's results: no new snapshots.
  const lockedMeetingIds = new Set(
    committeeApprovals.map((approval) => approval.meeting_id),
  );
  const approvalCountBySnapshotId = new Map<string, number>();

  for (const approval of committeeApprovals) {
    approvalCountBySnapshotId.set(
      approval.result_snapshot_id,
      (approvalCountBySnapshotId.get(approval.result_snapshot_id) ?? 0) + 1,
    );
  }
  const approvalBySnapshotId = new Map(
    committeeApprovals.map((approval) => [approval.result_snapshot_id, approval]),
  );
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
    approvalBySnapshotId,
    lockedMeetingIds,
    approvedMeetingIds,
    approvedResultSnapshotIds,
    pendingManualBallotsByMeetingId,
  };
}

export type SharedAdminState = ReturnType<typeof deriveSharedAdminState>;
