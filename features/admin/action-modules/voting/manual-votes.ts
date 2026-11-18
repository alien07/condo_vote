"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredText,
  requireOfficeStaff,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { backToPage } from "@/features/admin/action-modules/feedback";
import { PAPER_BALLOT_MEETING_CLOSED, takesPaperBallots } from "@/features/admin/meeting-pickers";
import {
  answersFromFormData,
  submitManualBallotRecord,
} from "@/features/voting/core/ballot-service";
import {
  encodeManualVotePart,
  type ManualVoteActionState,
  manualVoteImportValues,
  manualVoteIdentityValues,
  manualVoteValidationState,
  validateManualVoteImport,
  validateManualVoteIdentity,
} from "@/features/admin/action-modules/voting/helpers";

export async function importManualVoteEntry(formData: FormData) {
  const importer = await requireOfficeStaff();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const questionId = requiredText(formData.get("question_id"), "Question");
  const choiceId = requiredText(formData.get("choice_id"), "Choice");
  const supabase = await createClient();
  const [questionResult, choiceResult] = await Promise.all([
    supabase
      .from("meeting_questions")
      .select("id")
      .eq("id", questionId)
      .eq("meeting_id", meetingId)
      .single(),
    supabase
      .from("meeting_choices")
      .select("id")
      .eq("id", choiceId)
      .eq("question_id", questionId)
      .single(),
  ]);

  if (questionResult.error) {
    throw questionResult.error;
  }

  if (choiceResult.error) {
    throw choiceResult.error;
  }

  const { data: manualBallot, error: manualBallotError } = await supabase
    .from("manual_ballots")
    .upsert(
      {
        meeting_id: meetingId,
        room_id: roomId,
        source_label: optionalText(formData.get("source_label")),
        audit_note: optionalText(formData.get("audit_note")),
        identity_status: "legacy",
        imported_by: importer.id,
        status: "submitted",
      },
      { onConflict: "meeting_id,room_id" },
    )
    .select("id")
    .single();

  if (manualBallotError) {
    throw manualBallotError;
  }

  const { error: answerError } = await supabase
    .from("manual_ballot_answers")
    .upsert(
      {
        manual_ballot_id: manualBallot.id,
        question_id: questionId,
        choice_id: choiceId,
      },
      { onConflict: "manual_ballot_id,question_id" },
    );

  if (answerError) {
    throw answerError;
  }

  await writeAuditLog(supabase, {
    action: "manual_ballot.imported",
    actorProfileId: importer.id,
    details: {
      choice_id: choiceId,
      question_id: questionId,
      room_id: roomId,
    },
    entityId: manualBallot.id,
    entityType: "manual_ballot",
  });
  revalidateAdminPaths();
}

/** Whether the meeting takes paper ballots now (2026-11-19). */
async function meetingTakesPaperBallots(meetingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("status, ends_at")
    .eq("id", meetingId)
    .maybeSingle();

  return Boolean(data && takesPaperBallots(data));
}

export async function startManualVoteImport(formData: FormData) {
  await requireOfficeStaff();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const voterProfileId = optionalText(formData.get("voter_profile_id"));
  const voterIdentityText = optionalText(formData.get("voter_identity_text"));

  if (!voterProfileId && !voterIdentityText) {
    throw new Error("Voter profile or pending voter identity is required.");
  }

  if (!(await meetingTakesPaperBallots(meetingId))) {
    throw new Error(PAPER_BALLOT_MEETING_CLOSED);
  }

  const params = new URLSearchParams();

  if (voterProfileId) {
    params.set("voterProfileId", voterProfileId);
  } else if (voterIdentityText) {
    params.set("voterName", voterIdentityText);
  }

  redirect(
    `/admin/voting/manual/${encodeManualVotePart(meetingId)}/${encodeManualVotePart(
      roomId,
    )}?${params.toString()}`,
  );
}

export async function startManualVoteImportWithState(
  _state: ManualVoteActionState,
  formData: FormData,
): Promise<ManualVoteActionState> {
  const values = manualVoteImportValues(formData);

  try {
    await requireOfficeStaff();
    const validation = manualVoteValidationState(
      validateManualVoteImport(values),
      values,
    );

    if (validation) {
      return validation;
    }

    if (!(await meetingTakesPaperBallots(values.meeting_id))) {
      return { fieldErrors: { meeting_id: PAPER_BALLOT_MEETING_CLOSED }, values };
    }

    const params = new URLSearchParams();

    if (values.voter_profile_id) {
      params.set("voterProfileId", values.voter_profile_id);
    } else if (values.voter_identity_text) {
      params.set("voterName", values.voter_identity_text);
    }

    return {
      redirectHref: `/admin/voting/manual/${encodeManualVotePart(
        values.meeting_id,
      )}/${encodeManualVotePart(values.room_id)}?${params.toString()}`,
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start manual vote import.",
      values,
    };
  }
}

export async function submitManualBallot(formData: FormData) {
  await requireOfficeStaff();
  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const voterProfileId = optionalText(formData.get("voter_profile_id"));
  const voterIdentityText = optionalText(formData.get("voter_identity_text"));

  if (!voterProfileId && !voterIdentityText) {
    throw new Error("Voter profile or pending voter identity is required.");
  }

  const supabase = await createClient();

  // Answer validation, upsert, answers, and audit run in one transaction in
  // the voting core service; it refuses a meeting that does not take paper
  // ballots (0044). A refusal stays on the form with the reason (admin
  // action standard).
  try {
    await submitManualBallotRecord(supabase, {
      meetingId,
      roomId,
      voterProfileId,
      voterIdentityText,
      auditNote: optionalText(formData.get("audit_note")),
      answers: answersFromFormData(formData),
    });
  } catch (error) {
    unstable_rethrow(error);
    await backToPage("error", error instanceof Error ? error.message : String(error));
  }

  revalidateAdminPaths();
  redirect(`/admin/voting?${new URLSearchParams({ feedback: "success", message: "Paper ballot saved" })}`);
}

export async function resolveManualBallotIdentity(formData: FormData) {
  const resolver = await requireOfficeStaff();

  const id = requiredText(formData.get("id"), "Manual ballot");
  const voterProfileId = requiredText(formData.get("voter_profile_id"), "Voter profile");
  const supabase = await createClient();
  const [manualBallotResult, profileResult] = await Promise.all([
    supabase
      .from("manual_ballots")
      .select("id, meeting_id, room_id, identity_status, status, voter_identity_text")
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id")
      .eq("id", voterProfileId)
      .single(),
  ]);

  if (manualBallotResult.error) {
    throw manualBallotResult.error;
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (
    manualBallotResult.data.identity_status !== "pending" &&
    manualBallotResult.data.status !== "draft"
  ) {
    throw new Error("This manual vote identity is already resolved.");
  }

  const { error } = await supabase
    .from("manual_ballots")
    .update({
      identity_status: "linked",
      source_label: "manual_on_site",
      status: "submitted",
      voter_profile_id: voterProfileId,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "manual_ballot.identity_resolved",
    actorProfileId: resolver.id,
    details: {
      meeting_id: manualBallotResult.data.meeting_id,
      previous_identity_text: manualBallotResult.data.voter_identity_text,
      room_id: manualBallotResult.data.room_id,
      voter_profile_id: voterProfileId,
    },
    entityId: id,
    entityType: "manual_ballot",
  });
  revalidateAdminPaths();
  redirect("/admin/voting");
}

export async function resolveManualBallotIdentityWithState(
  _state: ManualVoteActionState,
  formData: FormData,
): Promise<ManualVoteActionState> {
  const values = manualVoteIdentityValues(formData);

  try {
    const resolver = await requireOfficeStaff();
    const validation = manualVoteValidationState(
      validateManualVoteIdentity(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const [manualBallotResult, profileResult] = await Promise.all([
      supabase
        .from("manual_ballots")
        .select("id, meeting_id, room_id, identity_status, status, voter_identity_text")
        .eq("id", values.id)
        .single(),
      supabase.from("profiles").select("id").eq("id", values.voter_profile_id).single(),
    ]);

    if (manualBallotResult.error) {
      return { error: manualBallotResult.error.message, values };
    }

    if (profileResult.error) {
      return { error: profileResult.error.message, values };
    }

    if (
      manualBallotResult.data.identity_status !== "pending" &&
      manualBallotResult.data.status !== "draft"
    ) {
      return { error: "This manual vote identity is already resolved.", values };
    }

    const { error } = await supabase
      .from("manual_ballots")
      .update({
        identity_status: "linked",
        source_label: "manual_on_site",
        status: "submitted",
        voter_profile_id: values.voter_profile_id,
      })
      .eq("id", values.id);

    if (error) {
      return { error: error.message, values };
    }

    await writeAuditLog(supabase, {
      action: "manual_ballot.identity_resolved",
      actorProfileId: resolver.id,
      details: {
        meeting_id: manualBallotResult.data.meeting_id,
        previous_identity_text: manualBallotResult.data.voter_identity_text,
        room_id: manualBallotResult.data.room_id,
        voter_profile_id: values.voter_profile_id,
      },
      entityId: values.id,
      entityType: "manual_ballot",
    });
    revalidateAdminPaths();

    return {
      recordId: values.id,
      success: "Manual vote identity linked",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not resolve manual vote identity.",
      values,
    };
  }
}
