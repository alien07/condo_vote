"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalDate,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";

function encodeManualVotePart(value: string) {
  return encodeURIComponent(value);
}

export async function createProxyAuthorization(formData: FormData) {
  const admin = await requireAdmin();

  const supabase = await createClient();
  const { data: authorization, error } = await supabase
    .from("proxy_authorizations")
    .insert({
      meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
      room_id: requiredText(formData.get("room_id"), "Room"),
      owner_id: optionalText(formData.get("owner_id")),
      proxy_profile_id: requiredText(formData.get("proxy_profile_id"), "Proxy profile"),
      valid_from: optionalDate(formData.get("valid_from")),
      valid_until: optionalDate(formData.get("valid_until")),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "proxy_authorization.created",
    actorProfileId: admin.id,
    entityId: authorization.id,
    entityType: "proxy_authorization",
  });
  revalidateAdminPaths();
  redirect(
    "/admin/proxies?feedback=success&message=Proxy%20authorization%20created",
  );
}

export async function reviewProxyAuthorization(formData: FormData) {
  const reviewer = await requireAdmin();

  const id = requiredText(formData.get("id"), "Proxy authorization ID");
  const status = requiredText(formData.get("status"), "Status");
  const supabase = await createClient();
  const { error } = await supabase
    .from("proxy_authorizations")
    .update({
      status,
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "proxy_authorization.reviewed",
    actorProfileId: reviewer.id,
    details: { status },
    entityId: id,
    entityType: "proxy_authorization",
  });
  revalidateAdminPaths();
  redirect(
    "/admin/proxies?feedback=success&message=Proxy%20authorization%20reviewed",
  );
}

export async function importManualVoteEntry(formData: FormData) {
  const importer = await requireAdmin();

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

export async function startManualVoteImport(formData: FormData) {
  await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const voterProfileId = optionalText(formData.get("voter_profile_id"));
  const voterIdentityText = optionalText(formData.get("voter_identity_text"));

  if (!voterProfileId && !voterIdentityText) {
    throw new Error("Voter profile or pending voter identity is required.");
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

export async function submitManualBallot(formData: FormData) {
  const importer = await requireAdmin();
  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const voterProfileId = optionalText(formData.get("voter_profile_id"));
  const voterIdentityText = optionalText(formData.get("voter_identity_text"));

  if (!voterProfileId && !voterIdentityText) {
    throw new Error("Voter profile or pending voter identity is required.");
  }

  const supabase = await createClient();
  const questionsResult = await supabase
    .from("meeting_questions")
    .select("id, question_text, meeting_choices(id)")
    .eq("meeting_id", meetingId);

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  const answers = questionsResult.data.map((question) => {
    const choiceId = requiredText(
      formData.get(`choice:${question.id}`),
      question.question_text,
    );
    const validChoiceIds = new Set(
      question.meeting_choices.map((choice) => choice.id),
    );

    if (!validChoiceIds.has(choiceId)) {
      throw new Error("Selected choice does not belong to this question.");
    }

    return {
      choice_id: choiceId,
      question_id: question.id,
    };
  });
  const pendingIdentity = !voterProfileId;
  const { data: manualBallot, error: manualBallotError } = await supabase
    .from("manual_ballots")
    .upsert(
      {
        audit_note: optionalText(formData.get("audit_note")),
        identity_status: pendingIdentity ? "pending" : "linked",
        imported_by: importer.id,
        meeting_id: meetingId,
        room_id: roomId,
        source_label: pendingIdentity ? "manual_pending_identity" : "manual_on_site",
        status: pendingIdentity ? "draft" : "submitted",
        voter_identity_text: pendingIdentity ? voterIdentityText : null,
        voter_profile_id: voterProfileId,
      },
      { onConflict: "meeting_id,room_id" },
    )
    .select("id")
    .single();

  if (manualBallotError) {
    throw manualBallotError;
  }

  const { error: answersError } = await supabase.from("manual_ballot_answers").upsert(
    answers.map((answer) => ({
      manual_ballot_id: manualBallot.id,
      ...answer,
    })),
    { onConflict: "manual_ballot_id,question_id" },
  );

  if (answersError) {
    throw answersError;
  }

  await writeAuditLog(supabase, {
    action: pendingIdentity
      ? "manual_ballot.pending_identity_saved"
      : "manual_ballot.submitted",
    actorProfileId: importer.id,
    details: {
      meeting_id: meetingId,
      pending_identity: pendingIdentity,
      room_id: roomId,
      voter_identity_text: pendingIdentity ? voterIdentityText : null,
      voter_profile_id: voterProfileId,
    },
    entityId: manualBallot.id,
    entityType: "manual_ballot",
  });
  revalidateAdminPaths();
  redirect("/admin/voting");
}

export async function resolveManualBallotIdentity(formData: FormData) {
  const resolver = await requireAdmin();

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

export async function resolveVoteSourceConflict(formData: FormData) {
  const resolver = await requireAdmin();

  const chosenSource = requiredText(formData.get("chosen_source"), "Chosen source");
  const onlineBallotId = requiredText(
    formData.get("online_ballot_id"),
    "Online ballot",
  );
  const manualBallotId = requiredText(
    formData.get("manual_ballot_id"),
    "Manual ballot",
  );
  const chosenBallotId =
    chosenSource === "online" ? onlineBallotId : manualBallotId;
  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const supabase = await createClient();
  const { data: resolution, error } = await supabase.from("vote_source_resolutions").upsert(
    {
      meeting_id: meetingId,
      room_id: roomId,
      online_ballot_id: onlineBallotId,
      manual_ballot_id: manualBallotId,
      chosen_source: chosenSource,
      chosen_ballot_id: chosenBallotId,
      conflict_remark: optionalText(formData.get("conflict_remark")),
      resolved_by: resolver.id,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,room_id" },
  )
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "vote_source_conflict.resolved",
    actorProfileId: resolver.id,
    details: {
      chosen_ballot_id: chosenBallotId,
      chosen_source: chosenSource,
      meeting_id: meetingId,
      room_id: roomId,
    },
    entityId: resolution.id,
    entityType: "vote_source_resolution",
  });
  revalidateAdminPaths();
  redirect("/admin/voting/conflicts?feedback=success&message=Conflict%20resolved");
}
