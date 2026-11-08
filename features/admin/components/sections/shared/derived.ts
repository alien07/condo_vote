import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";

export function deriveSharedAdminState({
  appRoles,
  committeeApprovals,
  pendingManualBallots,
  profiles,
}: Pick<
  AdminDashboardData,
  "appRoles" | "committeeApprovals" | "pendingManualBallots" | "profiles"
>) {
  const approvedResultSnapshotIds = new Set(
    committeeApprovals.map((approval) => approval.result_snapshot_id),
  );
  const approvalBySnapshotId = new Map(
    committeeApprovals.map((approval) => [approval.result_snapshot_id, approval]),
  );
  const approvedMeetingIds = new Set(
    committeeApprovals.map((approval) => approval.meeting_id),
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
    approvalBySnapshotId,
    approvedMeetingIds,
    approvedResultSnapshotIds,
    pendingManualBallotsByMeetingId,
  };
}

export type SharedAdminState = ReturnType<typeof deriveSharedAdminState>;
