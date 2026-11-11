"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { scheduleResultPdfs } from "@/features/results/pdf/schedule";
import {
  approvalMessage,
  approveResult,
} from "@/features/results/committee-service";
import { buildResultPayload } from "@/features/results/snapshot-payload";

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
    condoProfileResult,
    incidentsResult,
  ] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule, ballot_secrecy, advance_starts_at, advance_ends_at, notice_sent_at, meeting_round, identity_method, recording_reference, traffic_log_reference",
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
        .select("room_id, ownership_percent, voter_type")
        .eq("meeting_id", meetingId),
      supabase
        .from("ballots")
        .select("id, room_id, status, submitted_at")
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
      // The official record keeps the juristic person's details as they were.
      supabase
        .from("condo_profiles")
        .select("project_name, juristic_name, registration_no, tax_id, address, manager_name")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("meeting_incidents")
        .select("started_at, ended_at, description, action_taken")
        .eq("meeting_id", meetingId)
        .order("started_at", { ascending: true }),
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

  if (condoProfileResult.error) {
    throw condoProfileResult.error;
  }

  if (incidentsResult.error) {
    throw incidentsResult.error;
  }

  const { payload, effectiveVoteRooms, sourceConflicts } = buildResultPayload({
    meeting: meetingResult.data,
    condo: condoProfileResult.data[0] ?? null,
    incidents: incidentsResult.data,
    questions: questionsResult.data,
    eligible: eligibleResult.data,
    ballots: ballotsResult.data,
    manualBallots: manualBallotsResult.data,
    resolutions: voteSourceResolutionsResult.data,
    onlineTally: onlineTallyResult.data ?? [],
    quorumRule: meetingResult.data.quorum_rule,
  });
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
      effective_vote_rooms: effectiveVoteRooms,
      meeting_id: meetingId,
      source_conflicts: sourceConflicts,
    },
    entityId: snapshot.id,
    entityType: "result_snapshot",
  });
  revalidateAdminPaths();
}

export async function approveResultSnapshot(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const resultSnapshotId = requiredText(formData.get("result_snapshot_id"), "Result snapshot");
  const approval = await approveResult(supabase, {
    notes: optionalText(formData.get("notes")),
    resultSnapshotId,
  });

  if (approval.published) {
    await scheduleResultPdfs(resultSnapshotId);
  }

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

    if (approval.published) {
      await scheduleResultPdfs(values.result_snapshot_id);
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
