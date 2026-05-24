"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

export async function submitBallot(formData: FormData) {
  const profile = await requireProfile();
  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const supabase = await createClient();
  const now = new Date();
  const [
    eligibilityResult,
    meetingResult,
    questionsResult,
    existingBallotResult,
  ] = await Promise.all([
    supabase
      .from("eligible_voters_snapshot")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("room_id", roomId)
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase
      .from("meetings")
      .select("id, status, starts_at, ends_at")
      .eq("id", meetingId)
      .single(),
    supabase
      .from("meeting_questions")
      .select("id, question_text, required, meeting_choices(id)")
      .eq("meeting_id", meetingId),
    supabase
      .from("ballots")
      .select("id, version_number")
      .eq("meeting_id", meetingId)
      .eq("room_id", roomId)
      .eq("voter_profile_id", profile.id)
      .maybeSingle(),
  ]);

  if (eligibilityResult.error) {
    throw eligibilityResult.error;
  }

  if (!eligibilityResult.data) {
    throw new Error("You are not eligible to vote for this room and meeting.");
  }

  if (meetingResult.error) {
    throw meetingResult.error;
  }

  if (meetingResult.data.status !== "published") {
    throw new Error("Voting is not open for this meeting.");
  }

  if (
    now < new Date(meetingResult.data.starts_at) ||
    now > new Date(meetingResult.data.ends_at)
  ) {
    throw new Error("Voting is outside the meeting voting window.");
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (existingBallotResult.error) {
    throw existingBallotResult.error;
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
      question_id: question.id,
      choice_id: choiceId,
    };
  });

  const versionNumber = (existingBallotResult.data?.version_number ?? 0) + 1;
  const submittedAt = now.toISOString();
  const ballotPayload = {
    meeting_id: meetingId,
    room_id: roomId,
    voter_profile_id: profile.id,
    status: "submitted",
    submitted_at: submittedAt,
    version_number: versionNumber,
  };
  const { data: ballot, error: ballotError } = existingBallotResult.data
    ? await supabase
        .from("ballots")
        .update(ballotPayload)
        .eq("id", existingBallotResult.data.id)
        .select("id")
        .single()
    : await supabase
        .from("ballots")
        .insert(ballotPayload)
        .select("id")
        .single();

  if (ballotError) {
    throw ballotError;
  }

  const { error: answersError } = await supabase.from("ballot_answers").upsert(
    answers.map((answer) => ({
      ballot_id: ballot.id,
      ...answer,
    })),
    { onConflict: "ballot_id,question_id" },
  );

  if (answersError) {
    throw answersError;
  }

  const { error: versionError } = await supabase.from("ballot_versions").insert({
    ballot_id: ballot.id,
    version_number: versionNumber,
    payload_json: {
      meeting_id: meetingId,
      room_id: roomId,
      submitted_at: submittedAt,
      answers,
    },
  });

  if (versionError) {
    throw versionError;
  }

  revalidatePath("/vote");
  revalidatePath(`/vote/${meetingId}/${roomId}`);
}
