"use server";

import {
  createClient,
  optionalText,
  queueResultApprovedEmails,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
  toNumber,
} from "@/features/admin/action-modules/shared";

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
          "id, room_id, source_label, audit_note, manual_ballot_answers(question_id, choice_id)",
        )
        .eq("meeting_id", meetingId),
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

  const { error: insertError } = await supabase.from("result_snapshots").insert({
    meeting_id: meetingId,
    generated_by: generator.id,
    payload_json: payload,
  });

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

  const { error } = await supabase.from("committee_approvals").insert({
    meeting_id: meetingId,
    result_snapshot_id: resultSnapshotId,
    approved_by: approver.id,
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    throw error;
  }

  await queueResultApprovedEmails(meetingId);

  revalidateAdminPaths();
}
