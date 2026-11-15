"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { resolveVoteConflict } from "@/features/voting/core/ballot-service";
import type {
  VoteSourceConflictActionState,
} from "@/features/admin/action-modules/voting/helpers";

export async function resolveVoteSourceConflict(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  await resolveVoteConflict(supabase, {
    meetingId: requiredText(formData.get("meeting_id"), "Meeting"),
    roomId: requiredText(formData.get("room_id"), "Room"),
    onlineBallotId: requiredText(formData.get("online_ballot_id"), "Online ballot"),
    manualBallotId: requiredText(formData.get("manual_ballot_id"), "Manual ballot"),
    chosenSource: requiredText(formData.get("chosen_source"), "Chosen source"),
    conflictRemark: optionalText(formData.get("conflict_remark")),
  });
  revalidateAdminPaths();
  redirect("/admin/voting/conflicts?feedback=success&message=Conflict%20resolved");
}

function voteSourceConflictValues(formData: FormData) {
  return Object.fromEntries(
    [
      "meeting_id",
      "room_id",
      "online_ballot_id",
      "manual_ballot_id",
      "chosen_source",
      "conflict_remark",
    ].map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

function validateVoteSourceConflict(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  for (const [field, label] of [
    ["meeting_id", "Meeting"],
    ["room_id", "Room"],
    ["online_ballot_id", "Online ballot"],
    ["manual_ballot_id", "Manual ballot"],
  ] as const) {
    if (!values[field]?.trim()) {
      fieldErrors[field] = `${label} is required.`;
    }
  }

  if (!["manual", "online"].includes(values.chosen_source)) {
    fieldErrors.chosen_source = "Chosen source is required.";
  }

  return fieldErrors;
}

function voteSourceConflictValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): VoteSourceConflictActionState | null {
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

export async function resolveVoteSourceConflictWithState(
  _state: VoteSourceConflictActionState,
  formData: FormData,
): Promise<VoteSourceConflictActionState> {
  const values = voteSourceConflictValues(formData);

  try {
    await requireAdmin();
    const validation = voteSourceConflictValidationState(
      validateVoteSourceConflict(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();

    await resolveVoteConflict(supabase, {
      meetingId: values.meeting_id,
      roomId: values.room_id,
      onlineBallotId: values.online_ballot_id,
      manualBallotId: values.manual_ballot_id,
      chosenSource: values.chosen_source,
      conflictRemark: optionalText(values.conflict_remark),
    });
    revalidateAdminPaths();

    return {
      recordKey: `${values.meeting_id}:${values.room_id}`,
      success: "Conflict resolved",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not resolve conflict.",
      values,
    };
  }
}
