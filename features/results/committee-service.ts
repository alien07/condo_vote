// Committee approvals and vote closing (D014). Rules live in
// supabase/migrations/0023_committee_approvals.sql; these wrappers call them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export class ResultError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ResultError";
  }
}

export function toResultError(error: { message: string }) {
  const match = error.message.match(/^(RESULT_[A-Z_]+):\s*([\s\S]*)$/);

  return match
    ? new ResultError(match[1], match[2])
    : new ResultError("RESULT_UNKNOWN", error.message);
}

export type ApprovalProgress = {
  approvals: number;
  required: number;
};

export async function approveResult(
  supabase: Client,
  input: { resultSnapshotId: string; notes: string | null },
) {
  const { data, error } = await supabase.rpc("approve_result_snapshot", {
    p_result_snapshot_id: input.resultSnapshotId,
    p_notes: input.notes ?? "",
  });

  if (error) {
    throw toResultError(error);
  }

  return data as ApprovalProgress & { published: boolean };
}

export async function approveCloseVoting(supabase: Client, meetingId: string) {
  const { data, error } = await supabase.rpc("approve_close_voting", {
    p_meeting_id: meetingId,
  });

  if (error) {
    throw toResultError(error);
  }

  return data as ApprovalProgress & { closed: boolean };
}

export type CommitteeOverview = {
  open_meetings: Array<{
    id: string;
    title: string;
    ends_at: string;
    required_approvals: number;
    close_approvals: number;
    approved_by_me: boolean;
  }>;
  pending_results: Array<{
    snapshot_id: string;
    meeting_id: string;
    title: string;
    generated_at: string;
    required_approvals: number;
    approvals: number;
    approved_by_me: boolean;
    payload: unknown;
  }>;
};

export async function getCommitteeOverview(supabase: Client) {
  const { data, error } = await supabase.rpc("committee_overview");

  if (error) {
    throw toResultError(error);
  }

  return data as CommitteeOverview;
}

export function approvalMessage(result: ApprovalProgress & { published: boolean }) {
  return result.published
    ? "Result approved and published"
    : `Approval recorded (${result.approvals} of ${result.required})`;
}
