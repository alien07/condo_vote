// Voting core service (D010). Every ballot write goes through these functions,
// which call one transactional Postgres function each. Business rules live in
// supabase/migrations/0020_voting_core_service.sql.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type BallotAnswerInput = {
  question_id: string;
  choice_ids: string[];
};

export type VoteErrorCode =
  | "VOTE_NOT_SIGNED_IN"
  | "VOTE_NOT_ELIGIBLE"
  | "VOTE_CLOSED"
  | "VOTE_ROOM_LOCKED"
  | "VOTE_INVALID_ANSWERS"
  | "VOTE_FORBIDDEN"
  | "VOTE_INVALID_CONFLICT"
  | "VOTE_PROXY_LIMIT"
  | "VOTE_ROOM_ALREADY_VOTED"
  | "VOTE_UNKNOWN";

export class VoteError extends Error {
  constructor(
    readonly code: VoteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VoteError";
  }
}

/** Converts a database error raised as "VOTE_CODE: message" into a VoteError. */
export function toVoteError(error: { message: string }): VoteError {
  const match = error.message.match(/^(VOTE_[A-Z_]+):\s*([\s\S]*)$/);

  if (match) {
    return new VoteError(match[1] as VoteErrorCode, match[2]);
  }

  return new VoteError("VOTE_UNKNOWN", error.message);
}

/**
 * Reads answers from form fields named `choice:<questionId>`. A field can
 * repeat for multiple-choice questions.
 */
export function answersFromFormData(formData: FormData): BallotAnswerInput[] {
  const byQuestion = new Map<string, string[]>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("choice:")) {
      continue;
    }

    const choiceId = String(value).trim();

    if (!choiceId) {
      continue;
    }

    const questionId = key.slice("choice:".length);
    byQuestion.set(questionId, [...(byQuestion.get(questionId) ?? []), choiceId]);
  }

  return [...byQuestion].map(([question_id, choice_ids]) => ({
    question_id,
    choice_ids,
  }));
}

export async function submitOnlineBallot(
  supabase: Client,
  input: { meetingId: string; roomId: string; answers: BallotAnswerInput[] },
) {
  const { data, error } = await supabase.rpc("submit_ballot", {
    p_meeting_id: input.meetingId,
    p_room_id: input.roomId,
    p_answers: input.answers,
  });

  if (error) {
    throw toVoteError(error);
  }

  return data as { ballot_id: string; version_number: number };
}

export async function submitManualBallotRecord(
  supabase: Client,
  input: {
    meetingId: string;
    roomId: string;
    voterProfileId: string | null;
    voterIdentityText: string | null;
    auditNote: string | null;
    answers: BallotAnswerInput[];
  },
) {
  const { data, error } = await supabase.rpc("submit_manual_ballot", {
    p_meeting_id: input.meetingId,
    p_room_id: input.roomId,
    // Postgres accepts null for an optional profile; the generated type is strict.
    p_voter_profile_id: input.voterProfileId as string,
    p_voter_identity_text: input.voterIdentityText ?? "",
    p_audit_note: input.auditNote ?? "",
    p_answers: input.answers,
  });

  if (error) {
    throw toVoteError(error);
  }

  return data as { manual_ballot_id: string; pending_identity: boolean };
}

export async function resolveVoteConflict(
  supabase: Client,
  input: {
    meetingId: string;
    roomId: string;
    onlineBallotId: string;
    manualBallotId: string;
    chosenSource: string;
    conflictRemark: string | null;
  },
) {
  const { data, error } = await supabase.rpc("resolve_vote_source_conflict", {
    p_meeting_id: input.meetingId,
    p_room_id: input.roomId,
    p_online_ballot_id: input.onlineBallotId,
    p_manual_ballot_id: input.manualBallotId,
    p_chosen_source: input.chosenSource,
    p_conflict_remark: input.conflictRemark ?? "",
  });

  if (error) {
    throw toVoteError(error);
  }

  return data as { resolution_id: string };
}
