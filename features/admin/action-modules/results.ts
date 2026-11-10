"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
  toNumber,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import {
  approvalMessage,
  approveResult,
} from "@/features/results/committee-service";
import {
  describePassRule,
  evaluateQuestion,
  evaluateQuorum,
  isPassBasis,
  isPassOperator,
  type PassRule,
} from "@/features/results/pass-rules";

export type ResultApprovalActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

function resultApprovalValues(formData: FormData) {
  return Object.fromEntries(
    ["meeting_id", "result_snapshot_id", "notes"].map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

function resultApprovalValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): ResultApprovalActionState | null {
  const count = Object.keys(fieldErrors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors,
    values,
  };
}

function validateResultApproval(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!values.meeting_id?.trim()) {
    fieldErrors.meeting_id = "Meeting ID is required.";
  }

  if (!values.result_snapshot_id?.trim()) {
    fieldErrors.result_snapshot_id = "Result snapshot ID is required.";
  }

  return fieldErrors;
}

async function assertNoPendingManualVoteIdentities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string,
) {
  const { count, error } = await supabase
    .from("manual_ballots")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId)
    .or("identity_status.eq.pending,status.eq.draft");

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      `Resolve ${count} pending manual vote identity record(s) before generating or approving results. Go to Admin > Voting > Manual votes to fix them.`,
    );
  }
}

export async function generateResultSnapshot(formData: FormData) {
  const generator = await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();
  // A snapshot can have several approvals (D014), so check for any row.
  const { data: existingApprovals, error: existingApprovalError } = await supabase
    .from("committee_approvals")
    .select("id")
    .eq("meeting_id", meetingId)
    .limit(1);

  if (existingApprovalError) {
    throw existingApprovalError;
  }

  if (existingApprovals.length > 0) {
    throw new Error("Cannot generate a new result after committee approval.");
  }

  await assertNoPendingManualVoteIdentities(supabase, meetingId);

  const [
    meetingResult,
    questionsResult,
    eligibleResult,
    ballotsResult,
    manualBallotsResult,
    voteSourceResolutionsResult,
    onlineTallyResult,
  ] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule",
        )
        .eq("id", meetingId)
        .single(),
      supabase
        .from("meeting_questions")
        .select(
          "id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, pass_basis, pass_operator, pass_percent, requires_land_office_registration, legal_note, display_order, meeting_choices(id, choice_text, display_order, is_abstain)",
        )
        .eq("meeting_id", meetingId)
        .order("display_order", { ascending: true }),
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", meetingId),
      supabase
        .from("ballots")
        .select("id, room_id, status")
        .eq("meeting_id", meetingId)
        .eq("status", "submitted"),
      supabase
        .from("manual_ballots")
        .select(
          "id, room_id, source_label, audit_note, identity_status, voter_profile_id, voter_identity_text, manual_ballot_answers(question_id, choice_id)",
        )
        .eq("meeting_id", meetingId)
        .eq("status", "submitted")
        .neq("identity_status", "pending"),
      supabase
        .from("vote_source_resolutions")
        .select(
          "room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at",
        )
        .eq("meeting_id", meetingId),
      // Online totals are summed in the database so secret ballots (D015)
      // never expose per-room answers to admins.
      supabase.rpc("meeting_online_tally", { p_meeting_id: meetingId }),
    ]);

  if (meetingResult.error) {
    throw meetingResult.error;
  }

  if (
    meetingResult.data.status === "published" &&
    Date.parse(meetingResult.data.ends_at) > Date.now()
  ) {
    throw new Error(
      "Voting is still open. Results can be generated after the end time or after the committee approves closing voting.",
    );
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (eligibleResult.error) {
    throw eligibleResult.error;
  }

  if (ballotsResult.error) {
    throw ballotsResult.error;
  }

  if (manualBallotsResult.error) {
    throw manualBallotsResult.error;
  }

  if (voteSourceResolutionsResult.error) {
    throw voteSourceResolutionsResult.error;
  }

  if (onlineTallyResult.error) {
    throw onlineTallyResult.error;
  }

  const ownershipByRoom = new Map(
    eligibleResult.data.map((eligible) => [
      eligible.room_id,
      toNumber(eligible.ownership_percent),
    ]),
  );
  const onlineBallotByRoom = new Map(
    ballotsResult.data.map((ballot) => [ballot.room_id, ballot]),
  );
  const manualBallotByRoom = new Map(
    manualBallotsResult.data.map((manualBallot) => [
      manualBallot.room_id,
      manualBallot,
    ]),
  );
  const onlineRoomIds = new Set(onlineBallotByRoom.keys());
  const manualRoomIds = new Set(manualBallotByRoom.keys());
  const resolutionByRoom = new Map(
    voteSourceResolutionsResult.data.map((resolution) => [
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

  for (const row of onlineTallyResult.data ?? []) {
    countsByChoice.set(row.choice_id, {
      voteCount: row.vote_count,
      ownership: toNumber(row.ownership),
    });
  }

  for (const manualBallot of manualBallotsResult.data) {
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
    meetingResult.data.quorum_rule,
    submittedOwnership,
    totalEligibleOwnership,
  );
  const payload = {
    meeting: meetingResult.data,
    generated_at: new Date().toISOString(),
    totals: {
      quorum,
      eligible_voters: eligibleResult.data.length,
      submitted_ballots: submittedRoomIds.size,
      online_ballots: ballotsResult.data.length,
      manual_ballots: manualBallotsResult.data.length,
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
    questions: questionsResult.data.map((question) => {
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

  const { data: snapshot, error: insertError } = await supabase
    .from("result_snapshots")
    .insert({
      meeting_id: meetingId,
      generated_by: generator.id,
      payload_json: payload,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "closed" })
    .eq("id", meetingId)
    .neq("status", "archived");

  if (meetingError) {
    throw meetingError;
  }

  await writeAuditLog(supabase, {
    action: "result_snapshot.generated",
    actorProfileId: generator.id,
    details: {
      effective_vote_rooms: submittedRoomIds.size,
      meeting_id: meetingId,
      source_conflicts: conflicts.length,
    },
    entityId: snapshot.id,
    entityType: "result_snapshot",
  });
  revalidateAdminPaths();
}

export async function approveResultSnapshot(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  await approveResult(supabase, {
    notes: optionalText(formData.get("notes")),
    resultSnapshotId: requiredText(formData.get("result_snapshot_id"), "Result snapshot"),
  });
  revalidateAdminPaths();
  redirect("/admin/results?feedback=success&message=Result%20approved");
}

export async function approveResultSnapshotWithState(
  _state: ResultApprovalActionState,
  formData: FormData,
): Promise<ResultApprovalActionState> {
  const values = resultApprovalValues(formData);

  try {
    await requireAdmin();
    const validation = resultApprovalValidationState(
      validateResultApproval(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    // Approval, publication at the minimum, email queue, and audit run in
    // one transaction (D014).
    let approval;

    try {
      approval = await approveResult(supabase, {
        notes: optionalText(values.notes),
        resultSnapshotId: values.result_snapshot_id,
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not approve result.",
        values,
      };
    }

    revalidateAdminPaths();

    return {
      recordId: values.result_snapshot_id,
      success: approvalMessage(approval),
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not approve result.",
      values,
    };
  }
}
