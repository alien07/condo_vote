// Builds the result snapshot payload from data already read from the
// database. Pure: no database access, so the demo seed script
// (scripts/seed-demo.mjs) builds results exactly like "Generate result".
import {
  describePassRule,
  evaluateQuestion,
  evaluateQuorum,
  isPassBasis,
  isPassOperator,
  type PassRule,
} from "@/features/results/pass-rules";
import type { Json } from "@/lib/supabase/database.types";

type JsonRecord = { [key: string]: Json | undefined };

type Numeric = number | string | null | undefined;

function toNumber(value: Numeric) {
  return Number(value ?? 0);
}

export type ResultPayloadInput = {
  meeting: JsonRecord & { advance_ends_at: string | null };
  condo: JsonRecord | null;
  incidents: JsonRecord[];
  questions: Array<{
    id: string;
    agenda_no: string | null;
    agenda_title: string | null;
    question_text: string;
    question_type: string;
    resolution_type: string;
    required_threshold: string;
    pass_basis: string;
    pass_operator: string;
    pass_percent: Numeric;
    requires_land_office_registration: boolean;
    legal_note: string | null;
    meeting_choices: Array<{
      id: string;
      choice_text: string;
      display_order: number;
      is_abstain: boolean;
    }>;
  }>;
  eligible: Array<{ room_id: string; ownership_percent: Numeric; voter_type: string }>;
  ballots: Array<{ id: string; room_id: string; submitted_at: string | null }>;
  manualBallots: Array<{
    id: string;
    room_id: string;
    manual_ballot_answers: Array<{ question_id: string; choice_id: string }>;
  }>;
  resolutions: Array<{
    room_id: string;
    online_ballot_id: string;
    manual_ballot_id: string;
    chosen_source: string;
    chosen_ballot_id: string;
    conflict_remark: string | null;
    resolved_at: string;
  }>;
  onlineTally: Array<{ choice_id: string; vote_count: number; ownership: Numeric }>;
  quorumRule: string;
  now?: Date;
};

export function buildResultPayload(input: ResultPayloadInput) {
  const ownershipByRoom = new Map(
    input.eligible.map((eligible) => [
      eligible.room_id,
      toNumber(eligible.ownership_percent),
    ]),
  );
  const onlineBallotByRoom = new Map(
    input.ballots.map((ballot) => [ballot.room_id, ballot]),
  );
  const manualBallotByRoom = new Map(
    input.manualBallots.map((manualBallot) => [
      manualBallot.room_id,
      manualBallot,
    ]),
  );
  const onlineRoomIds = new Set(onlineBallotByRoom.keys());
  const manualRoomIds = new Set(manualBallotByRoom.keys());
  const resolutionByRoom = new Map(
    input.resolutions.map((resolution) => [
      resolution.room_id,
      resolution,
    ]),
  );
  const conflicts = [...manualRoomIds]
    .filter((roomId) => onlineRoomIds.has(roomId))
    .map((roomId) => {
      const onlineBallot = onlineBallotByRoom.get(roomId);
      const manualBallot = manualBallotByRoom.get(roomId);
      const resolution = resolutionByRoom.get(roomId);
      const matchingResolution =
        resolution &&
        onlineBallot &&
        manualBallot &&
        resolution.online_ballot_id === onlineBallot.id &&
        resolution.manual_ballot_id === manualBallot.id
          ? resolution
          : null;

      return {
        room_id: roomId,
        online_ballot_id: onlineBallot?.id ?? null,
        manual_ballot_id: manualBallot?.id ?? null,
        resolution: matchingResolution,
      };
    });
  const unresolvedConflicts = conflicts.filter((conflict) => !conflict.resolution);

  if (unresolvedConflicts.length > 0) {
    throw new Error(
      `Resolve ${unresolvedConflicts.length} manual/online vote conflict(s) before generating results.`,
    );
  }

  const effectiveRoomSources = new Map<string, "online" | "manual">();

  for (const roomId of onlineRoomIds) {
    effectiveRoomSources.set(roomId, "online");
  }

  for (const roomId of manualRoomIds) {
    effectiveRoomSources.set(roomId, "manual");
  }

  for (const conflict of conflicts) {
    effectiveRoomSources.set(
      conflict.room_id,
      conflict.resolution?.chosen_source === "online" ? "online" : "manual",
    );
  }

  const submittedRoomIds = new Set(effectiveRoomSources.keys());
  // Record details: rooms that voted through a proxy (Condominium Act s.47),
  // and online ballots by voting phase (advance or meeting day).
  const voterTypeByRoom = new Map(
    input.eligible.map((eligible) => [eligible.room_id, eligible.voter_type]),
  );
  const proxyRooms = [...submittedRoomIds].filter(
    (roomId) => voterTypeByRoom.get(roomId) === "proxy",
  ).length;
  const advanceEnds = input.meeting.advance_ends_at
    ? Date.parse(input.meeting.advance_ends_at)
    : null;
  const effectiveOnlineBallots = input.ballots.filter(
    (ballot) => effectiveRoomSources.get(ballot.room_id) === "online",
  );
  const advanceOnlineBallots = effectiveOnlineBallots.filter(
    (ballot) =>
      advanceEnds !== null &&
      ballot.submitted_at !== null &&
      Date.parse(ballot.submitted_at) <= advanceEnds,
  ).length;
  const effectiveManualBallots = [...effectiveRoomSources.values()].filter(
    (source) => source === "manual",
  ).length;
  const totalEligibleOwnership = [...ownershipByRoom.values()].reduce(
    (sum, ownership) => sum + ownership,
    0,
  );
  const submittedOwnership = [...submittedRoomIds].reduce(
    (sum, roomId) => sum + (ownershipByRoom.get(roomId) ?? 0),
    0,
  );
  const countsByChoice = new Map<
    string,
    {
      voteCount: number;
      ownership: number;
    }
  >();

  for (const row of input.onlineTally) {
    countsByChoice.set(row.choice_id, {
      voteCount: row.vote_count,
      ownership: toNumber(row.ownership),
    });
  }

  for (const manualBallot of input.manualBallots) {
    if (effectiveRoomSources.get(manualBallot.room_id) !== "manual") {
      continue;
    }

    const ownership = ownershipByRoom.get(manualBallot.room_id) ?? 0;

    for (const answer of manualBallot.manual_ballot_answers) {
      const current = countsByChoice.get(answer.choice_id) ?? {
        voteCount: 0,
        ownership: 0,
      };

      countsByChoice.set(answer.choice_id, {
        voteCount: current.voteCount + 1,
        ownership: current.ownership + ownership,
      });
    }
  }

  const quorum = evaluateQuorum(
    input.quorumRule,
    submittedOwnership,
    totalEligibleOwnership,
  );
  const payload = {
    meeting: input.meeting,
    condo: input.condo,
    incidents: input.incidents,
    generated_at: (input.now ?? new Date()).toISOString(),
    totals: {
      proxy_rooms: proxyRooms,
      advance_online_ballots: advanceOnlineBallots,
      meeting_day_online_ballots: effectiveOnlineBallots.length - advanceOnlineBallots,
      effective_manual_ballots: effectiveManualBallots,
      quorum,
      eligible_voters: input.eligible.length,
      submitted_ballots: submittedRoomIds.size,
      online_ballots: input.ballots.length,
      manual_ballots: input.manualBallots.length,
      effective_vote_rooms: submittedRoomIds.size,
      total_eligible_ownership: totalEligibleOwnership,
      submitted_ownership: submittedOwnership,
      source_conflicts: conflicts.length,
      resolved_source_conflicts: conflicts.filter((conflict) => conflict.resolution)
        .length,
    },
    vote_source_audit: {
      online_room_ids: [...onlineRoomIds],
      manual_room_ids: [...manualRoomIds],
      effective_sources: [...effectiveRoomSources].map(([roomId, source]) => ({
        room_id: roomId,
        source,
      })),
      conflicts: conflicts.map((conflict) => ({
        room_id: conflict.room_id,
        online_ballot_id: conflict.online_ballot_id,
        manual_ballot_id: conflict.manual_ballot_id,
        chosen_source: conflict.resolution?.chosen_source ?? null,
        chosen_ballot_id: conflict.resolution?.chosen_ballot_id ?? null,
        conflict_remark: conflict.resolution?.conflict_remark ?? null,
        resolved_at: conflict.resolution?.resolved_at ?? null,
      })),
    },
    questions: input.questions.map((question) => {
      const passRule: PassRule = {
        basis: isPassBasis(question.pass_basis) ? question.pass_basis : "voting_ownership",
        operator: isPassOperator(question.pass_operator) ? question.pass_operator : "gt",
        percent: toNumber(question.pass_percent),
      };
      const sortedChoices = [...question.meeting_choices].sort(
        (left, right) => left.display_order - right.display_order,
      );
      const evaluation = evaluateQuestion({
        rule: passRule,
        questionType: question.question_type,
        choices: sortedChoices.map((choice) => ({
          id: choice.id,
          isAbstain: choice.is_abstain,
          ownership: countsByChoice.get(choice.id)?.ownership ?? 0,
        })),
        votingOwnership: submittedOwnership,
        totalOwnership: totalEligibleOwnership,
      });
      const evaluationByChoice = new Map(
        evaluation.choices.map((choice) => [choice.id, choice]),
      );

      return {
      id: question.id,
      agenda_no: question.agenda_no,
      agenda_title: question.agenda_title,
      text: question.question_text,
      type: question.question_type,
      resolution_type: question.resolution_type,
      required_threshold: question.required_threshold,
      requires_land_office_registration:
        question.requires_land_office_registration,
      legal_note: question.legal_note,
      pass_rule: { ...passRule, label: describePassRule(passRule) },
      outcome: evaluation.outcome,
      basis_ownership: evaluation.basis_ownership,
      passed_choice_ids: evaluation.passed_choice_ids,
      decided_choice_id: evaluation.decided_choice_id,
      choices: sortedChoices
        .map((choice) => {
          const count = countsByChoice.get(choice.id) ?? {
            voteCount: 0,
            ownership: 0,
          };

          return {
            id: choice.id,
            text: choice.choice_text,
            is_abstain: choice.is_abstain,
            meets_rule: evaluationByChoice.get(choice.id)?.meets_rule ?? false,
            percent_of_basis: evaluationByChoice.get(choice.id)?.percent_of_basis ?? null,
            vote_count: count.voteCount,
            ownership: count.ownership,
            percent_of_total_ownership:
              totalEligibleOwnership > 0
                ? (count.ownership / totalEligibleOwnership) * 100
                : 0,
            percent_of_submitted_ownership:
              submittedOwnership > 0
                ? (count.ownership / submittedOwnership) * 100
                : 0,
          };
        }),
      };
    }),
  };

  return {
    payload,
    effectiveVoteRooms: submittedRoomIds.size,
    sourceConflicts: conflicts.length,
  };
}
