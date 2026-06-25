"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  queueResultApprovedEmails,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
  toNumber,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";

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
  const { data: existingApproval, error: existingApprovalError } = await supabase
    .from("committee_approvals")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (existingApprovalError) {
    throw existingApprovalError;
  }

  if (existingApproval) {
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
          "id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, requires_land_office_registration, legal_note, display_order, meeting_choices(id, choice_text, display_order)",
        )
        .eq("meeting_id", meetingId)
        .order("display_order", { ascending: true }),
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", meetingId),
      supabase
        .from("ballots")
        .select("id, room_id, status, ballot_answers(question_id, choice_id)")
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
    ]);

  if (meetingResult.error) {
    throw meetingResult.error;
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

  for (const ballot of ballotsResult.data) {
    if (effectiveRoomSources.get(ballot.room_id) !== "online") {
      continue;
    }

    const ownership = ownershipByRoom.get(ballot.room_id) ?? 0;

    for (const answer of ballot.ballot_answers) {
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

  const payload = {
    meeting: meetingResult.data,
    generated_at: new Date().toISOString(),
    totals: {
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
    questions: questionsResult.data.map((question) => ({
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
      choices: question.meeting_choices
        .sort((left, right) => left.display_order - right.display_order)
        .map((choice) => {
          const count = countsByChoice.get(choice.id) ?? {
            voteCount: 0,
            ownership: 0,
          };

          return {
            id: choice.id,
            text: choice.choice_text,
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
    })),
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
  const approver = await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting ID");
  const resultSnapshotId = requiredText(
    formData.get("result_snapshot_id"),
    "Result snapshot ID",
  );
  const supabase = await createClient();
  const [snapshotResult, existingApprovalResult] = await Promise.all([
    supabase
      .from("result_snapshots")
      .select("id")
      .eq("id", resultSnapshotId)
      .eq("meeting_id", meetingId)
      .single(),
    supabase
      .from("committee_approvals")
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle(),
  ]);

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  if (existingApprovalResult.error) {
    throw existingApprovalResult.error;
  }

  if (existingApprovalResult.data) {
    throw new Error("This meeting already has an approved result.");
  }

  await assertNoPendingManualVoteIdentities(supabase, meetingId);

  const { data: approval, error } = await supabase
    .from("committee_approvals")
    .insert({
      meeting_id: meetingId,
      result_snapshot_id: resultSnapshotId,
      approved_by: approver.id,
      notes: optionalText(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await queueResultApprovedEmails(meetingId);
  await writeAuditLog(supabase, {
    action: "result_snapshot.approved",
    actorProfileId: approver.id,
    details: {
      meeting_id: meetingId,
      result_snapshot_id: resultSnapshotId,
    },
    entityId: approval.id,
    entityType: "committee_approval",
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
    const approver = await requireAdmin();
    const validation = resultApprovalValidationState(
      validateResultApproval(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const [snapshotResult, existingApprovalResult] = await Promise.all([
      supabase
        .from("result_snapshots")
        .select("id")
        .eq("id", values.result_snapshot_id)
        .eq("meeting_id", values.meeting_id)
        .single(),
      supabase
        .from("committee_approvals")
        .select("id")
        .eq("meeting_id", values.meeting_id)
        .maybeSingle(),
    ]);

    if (snapshotResult.error) {
      return { error: snapshotResult.error.message, values };
    }

    if (existingApprovalResult.error) {
      return { error: existingApprovalResult.error.message, values };
    }

    if (existingApprovalResult.data) {
      return { error: "This meeting already has an approved result.", values };
    }

    try {
      await assertNoPendingManualVoteIdentities(supabase, values.meeting_id);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Resolve pending manual vote identity records before approving.",
        values,
      };
    }

    const { data: approval, error } = await supabase
      .from("committee_approvals")
      .insert({
        approved_by: approver.id,
        meeting_id: values.meeting_id,
        notes: optionalText(values.notes),
        result_snapshot_id: values.result_snapshot_id,
      })
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    await queueResultApprovedEmails(values.meeting_id);
    await writeAuditLog(supabase, {
      action: "result_snapshot.approved",
      actorProfileId: approver.id,
      details: {
        meeting_id: values.meeting_id,
        result_snapshot_id: values.result_snapshot_id,
      },
      entityId: approval.id,
      entityType: "committee_approval",
    });

    revalidateAdminPaths();

    return {
      recordId: values.result_snapshot_id,
      success: "Result approved",
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
