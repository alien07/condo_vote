// Committee approvals, close-early requests and correction requests (D014).
// Rules live in supabase/migrations/0023 and 0030; these wrappers call them.
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

type RequestStatus = "open" | "approved" | "failed" | "cancelled" | "lapsed";

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) {
    throw toResultError(error);
  }

  return data as T;
}

/** Close voting early through a request (0030, demo feedback item 10). */
export async function proposeCloseVoting(
  supabase: Client,
  input: { meetingId: string; reason: string; closeAt: string | null },
) {
  return unwrap<{ request_id: string; status: RequestStatus }>(
    await supabase.rpc("propose_close_voting", {
      p_meeting_id: input.meetingId,
      p_reason: input.reason,
      p_close_at: input.closeAt ?? undefined,
    }),
  );
}

export async function answerCloseRequest(
  supabase: Client,
  input: { requestId: string; answer: "approve" | "object"; reason: string | null },
) {
  return unwrap<{ request_id: string; status: RequestStatus }>(
    await supabase.rpc("answer_close_request", {
      p_request_id: input.requestId,
      p_answer: input.answer,
      p_reason: input.reason ?? undefined,
    }),
  );
}

export async function cancelCloseRequest(supabase: Client, requestId: string) {
  return unwrap<null>(await supabase.rpc("cancel_close_request", { p_request_id: requestId }));
}

/** Correction requests (0030, demo feedback item 12). */
export async function requestResultCorrection(
  supabase: Client,
  input: { resultSnapshotId: string; category: string; reason: string; legalReference: string | null },
) {
  return unwrap<{ request_id: string; level: string }>(
    await supabase.rpc("request_result_correction", {
      p_result_snapshot_id: input.resultSnapshotId,
      p_category: input.category,
      p_reason: input.reason,
      p_legal_reference: input.legalReference ?? undefined,
    }),
  );
}

export async function raiseCorrectionLevel(
  supabase: Client,
  input: { requestId: string; level: string; reason: string; legalReference: string | null },
) {
  return unwrap<null>(
    await supabase.rpc("raise_correction_level", {
      p_request_id: input.requestId,
      p_level: input.level,
      p_reason: input.reason,
      p_legal_reference: input.legalReference ?? undefined,
    }),
  );
}

export async function answerCorrectionRequest(
  supabase: Client,
  input: { requestId: string; status: "fixed" | "no_change"; answer: string },
) {
  return unwrap<null>(
    await supabase.rpc("answer_correction_request", {
      p_request_id: input.requestId,
      p_status: input.status,
      p_answer: input.answer,
    }),
  );
}

export type CommitteePerson = { profile_id: string; name: string; position: string | null };

export type CloseRequest = {
  id: string;
  reason: string;
  close_at: string | null;
  created_at: string;
  proposed_by: string;
  proposed_by_me: boolean;
  proposer: string | null;
  my_answer: "approve" | "object" | null;
  answers: Array<{
    profile_id: string;
    name: string | null;
    answer: "approve" | "object";
    reason: string | null;
    answered_at: string;
  }>;
};

export type CorrectionRequest = {
  id: string;
  result_snapshot_id: string;
  category: string;
  level: "low" | "medium" | "high";
  reason: string;
  legal_reference: string | null;
  status: "open" | "fixed" | "no_change";
  answer: string | null;
  answered_at: string | null;
  level_change_reason: string | null;
  level_changed_at: string | null;
  requested_by_me: boolean;
  requester: string | null;
  created_at: string;
};

export type CommitteeOverview = {
  is_member: boolean;
  members: CommitteePerson[];
  open_meetings: Array<{
    id: string;
    title: string;
    /** English title (0033); null when not written. */
    title_en: string | null;
    ends_at: string;
    required_approvals: number;
    request: CloseRequest | null;
    closes_early_at: string | null;
  }>;
  pending_results: Array<{
    snapshot_id: string;
    meeting_id: string;
    title: string;
    title_en: string | null;
    generated_at: string;
    required_approvals: number;
    approvals: number;
    approved_by_me: boolean;
    approval_list: Array<{
      profile_id: string;
      name: string | null;
      approved_at: string;
      notes: string | null;
    }>;
    corrections: CorrectionRequest[];
    previous_payload: unknown;
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
