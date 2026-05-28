"use server";

import {
  createClient,
  optionalDate,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";

export async function createProxyAuthorization(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("proxy_authorizations").insert({
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    room_id: requiredText(formData.get("room_id"), "Room"),
    owner_id: optionalText(formData.get("owner_id")),
    proxy_profile_id: requiredText(formData.get("proxy_profile_id"), "Proxy profile"),
    valid_from: optionalDate(formData.get("valid_from")),
    valid_until: optionalDate(formData.get("valid_until")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
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

  revalidateAdminPaths();
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

  revalidateAdminPaths();
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
  const supabase = await createClient();
  const { error } = await supabase.from("vote_source_resolutions").upsert(
    {
      meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
      room_id: requiredText(formData.get("room_id"), "Room"),
      online_ballot_id: onlineBallotId,
      manual_ballot_id: manualBallotId,
      chosen_source: chosenSource,
      chosen_ballot_id: chosenBallotId,
      conflict_remark: optionalText(formData.get("conflict_remark")),
      resolved_by: resolver.id,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,room_id" },
  );

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
