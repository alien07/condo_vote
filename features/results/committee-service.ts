// Committee approvals, close-early requests and correction requests (D014).
// Rules live in supabase/migrations/0023, 0030 and 0046 (majority and the
// chair's casting vote, D027); these wrappers call them.
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
  const match = error.message.match(/^((?:RESULT|COMMITTEE)_[A-Z_]+):\s*([\s\S]*)$/);

  return match
    ? new ResultError(match[1], match[2])
    : new ResultError("RESULT_UNKNOWN", error.message);
}

export type ApprovalProgress = {
  approvals: number;
  required: number;
};

export type TallyStatus = "open" | "passed" | "not_passed" | "tie";

/** committee_tally (0046, D027): n of N among active members. */
export type CommitteeTally = ApprovalProgress & {
  kind: "result" | "close_request";
  subject_id: string;
  meeting_id: string;
  /** N: active committee members today. */
  members: number;
  high_level: boolean;
  objections: number;
  /** Members who may answer (the generator of a result may not). */
  eligible: number;
  answered: number;
  status: TallyStatus;
  casting_vote: {
    decision: "approve" | "object";
    position: "chair" | "vice_chair";
    reason: string | null;
    at: string;
    name: string | null;
  } | null;
  chair: { profile_id: string; position: "chair" | "vice_chair"; name: string | null } | null;
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

  // held: approvals are complete but a correction request is open (0034).
  return data as CommitteeTally & { published: boolean; held?: boolean };
}

/** Object to a result with a reason (D027). Answers cannot change. */
export async function objectResult(supabase: Client, input: { resultSnapshotId: string; reason: string }) {
  const { data, error } = await supabase.rpc("object_result_snapshot", {
    p_result_snapshot_id: input.resultSnapshotId,
    p_reason: input.reason,
  });

  if (error) {
    throw toResultError(error);
  }

  return data as unknown as CommitteeTally;
}

/** The chair's (or vice chair's) casting vote on a tie (D027). */
export async function castDecidingVote(
  supabase: Client,
  input: { kind: "result" | "close_request"; subjectId: string; decision: "approve" | "object"; reason: string | null },
) {
  const { data, error } = await supabase.rpc("cast_committee_deciding_vote", {
    p_kind: input.kind,
    p_subject: input.subjectId,
    p_decision: input.decision,
    p_reason: input.reason ?? undefined,
  });

  if (error) {
    throw toResultError(error);
  }

  return data as unknown as CommitteeTally & { published: boolean };
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
  return unwrap<{ request_id: string; status: RequestStatus; tally: CommitteeTally }>(
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
  // published: the answer let a fully approved result be published (0034).
  return unwrap<{ status: string; published: boolean; result_snapshot_id: string | null }>(
    await supabase.rpc("answer_correction_request", {
      p_request_id: input.requestId,
      p_status: input.status,
      p_answer: input.answer,
    }),
  );
}

/** position is the Thai label; position_code and position_title give the page language (D026). */
export type CommitteePerson = {
  profile_id: string;
  name: string;
  position: string | null;
  position_code?: string | null;
  position_title?: string | null;
};

export type CloseRequest = {
  id: string;
  reason: string;
  close_at: string | null;
  created_at: string;
  proposed_by: string;
  proposed_by_me: boolean;
  proposer: string | null;
  tally: CommitteeTally;
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
  /** N: active committee members today (D027). */
  member_count: number;
  /** Who breaks a tie: the chair, else the vice chair; null when neither. */
  chair: CommitteeTally["chair"];
  i_am_chair: boolean;
  members: CommitteePerson[];
  open_meetings: Array<{
    id: string;
    title: string;
    /** English title (0033); null when not written. */
    title_en: string | null;
    /** Start of meeting-day voting (0036). */
    starts_at: string;
    ends_at: string;
    required_approvals: number;
    request: CloseRequest | null;
    /** The latest request that failed or was cancelled (0034), when none is open. */
    last_request: {
      status: string;
      reason: string;
      proposer: string | null;
      ended_at: string | null;
      answers: Array<{ name: string | null; answer: "approve" | "object"; reason: string | null }>;
    } | null;
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
    objected_by_me: boolean;
    tally: CommitteeTally;
    objection_list: Array<{
      profile_id: string;
      name: string | null;
      reason: string;
      objected_at: string;
    }>;
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
