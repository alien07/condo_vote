"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalBoolean,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import {
  type QuestionActionState,
  questionFormValues,
  validateQuestionForm,
  questionValidationState,
  questionPayload,
  questionPassRule,
} from "@/features/admin/action-modules/meetings/helpers";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Adds or removes the agenda item's Abstain choice (0041). Its text and
 * place are fixed by the database. */
async function setAbstain(supabase: ServerClient, questionId: string, wanted: boolean) {
  const { data: existing, error: readError } = await supabase
    .from("meeting_choices")
    .select("id")
    .eq("question_id", questionId)
    .eq("is_abstain", true)
    .maybeSingle();

  if (readError) {
    return readError.message;
  }

  if (wanted && !existing) {
    const { error } = await supabase.from("meeting_choices").insert({
      question_id: questionId,
      choice_text: "Abstain",
      display_order: 999,
      is_abstain: true,
    });

    return error?.message ?? null;
  }

  if (!wanted && existing) {
    const { error } = await supabase.from("meeting_choices").delete().eq("id", existing.id);

    return error?.message ?? null;
  }

  return null;
}

export async function createMeetingQuestionWithState(
  _state: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const values = questionFormValues(formData);

  try {
    await requireAdmin();
    const validation = questionValidationState(
      validateQuestionForm(values, false),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    // No order given: put the new item last (2026-11-18 review).
    const payload = questionPayload(values);

    if (!values.display_order.trim()) {
      const { data: last } = await supabase
        .from("meeting_questions")
        .select("display_order")
        .eq("meeting_id", payload.meeting_id)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      payload.display_order = (last?.display_order ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from("meeting_questions")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    const abstainError = await setAbstain(supabase, data.id, values.has_abstain === "on");

    if (abstainError) {
      return { error: abstainError, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Question added",
      values,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not add question.",
      values,
    };
  }
}

export async function updateMeetingQuestionWithState(
  _state: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const values = questionFormValues(formData);

  try {
    await requireAdmin();
    const validation = questionValidationState(
      validateQuestionForm(values, true),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meeting_questions")
      .update(questionPayload(values))
      .eq("id", values.id)
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    const abstainError = await setAbstain(supabase, data.id, values.has_abstain === "on");

    if (abstainError) {
      return { error: abstainError, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Question updated",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update question.",
      values,
    };
  }
}

export async function createMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const questionText = requiredText(formData.get("question_text"), "Question");
  const values = questionFormValues(formData);
  const { error } = await supabase.from("meeting_questions").insert({
    ...questionPassRule(values),
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    agenda_no: optionalText(formData.get("agenda_no")),
    agenda_title: optionalText(formData.get("agenda_title")),
    question_text: questionText,
    question_type: requiredText(formData.get("question_type"), "Question type"),
    resolution_type: requiredText(
      formData.get("resolution_type"),
      "Resolution type",
    ),
    required_threshold: requiredText(
      formData.get("required_threshold"),
      "Required threshold",
    ),
    requires_land_office_registration: optionalBoolean(
      formData.get("requires_land_office_registration"),
    ),
    legal_note: optionalText(formData.get("legal_note")),
    display_order: Number(formData.get("display_order") ?? 0),
    required: optionalBoolean(formData.get("required")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
  redirect(
    `/admin/meetings?tab=questions&feedback=success&message=${encodeURIComponent("Question added")}`,
  );
}

/** Back to the meeting's agenda with a message, so every agenda change says
 * what happened, and an error shows on the page instead of an error page
 * (2026-11-19). */
function backToAgenda(
  meetingId: string | null | undefined,
  feedback: "success" | "error",
  message: string,
  focusQuestionId?: string,
): never {
  const params = new URLSearchParams({ tab: "questions" });

  if (meetingId) {
    params.set("meeting", meetingId);
  }

  if (focusQuestionId) {
    params.set("focusQuestionId", focusQuestionId);
  }

  params.set("feedback", feedback);
  params.set("message", message);
  redirect(`/admin/meetings?${params.toString()}`);
}

async function questionMeeting(supabase: ServerClient, questionId: string) {
  const { data } = await supabase
    .from("meeting_questions")
    .select("meeting_id")
    .eq("id", questionId)
    .maybeSingle();

  return data?.meeting_id ?? null;
}

async function choiceQuestion(supabase: ServerClient, choiceId: string) {
  const { data } = await supabase
    .from("meeting_choices")
    .select("question_id, meeting_questions(meeting_id)")
    .eq("id", choiceId)
    .maybeSingle();

  return {
    questionId: data?.question_id,
    meetingId: data?.meeting_questions?.meeting_id ?? null,
  };
}

export async function deleteMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Question ID");
  const supabase = await createClient();
  const meetingId = await questionMeeting(supabase, id);
  // Its choices go with it (0042).
  const { error } = await supabase.from("meeting_questions").delete().eq("id", id);

  if (error) {
    backToAgenda(
      meetingId,
      "error",
      error.code === "23503" ? "This agenda item has votes and cannot be deleted." : error.message,
    );
  }

  revalidateAdminPaths();
  backToAgenda(meetingId, "success", "Question deleted");
}

export async function createMeetingChoice(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const questionId = requiredText(formData.get("question_id"), "Question");
  const choiceText = requiredText(formData.get("choice_text"), "Choice");
  const givenOrder = String(formData.get("display_order") ?? "").trim();
  let displayOrder = Number(givenOrder || 0);
  const meetingId = await questionMeeting(supabase, questionId);

  // No order given: after the other choices, before Abstain (order 999)
  // (2026-11-18 review).
  if (!givenOrder) {
    const { data: last } = await supabase
      .from("meeting_choices")
      .select("display_order")
      .eq("question_id", questionId)
      .eq("is_abstain", false)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    displayOrder = (last?.display_order ?? 0) + 1;
  }

  const { error } = await supabase.from("meeting_choices").insert({
    question_id: questionId,
    choice_text: choiceText,
    display_order: displayOrder,
  });

  if (error) {
    backToAgenda(meetingId, "error", error.message, questionId);
  }

  revalidateAdminPaths();
  backToAgenda(meetingId, "success", "Choice added", questionId);
}

/** Edits a choice's text and order (2026-11-18). Draft meetings only:
 * the database refuses others (0039, AGENDA_LOCKED). */
export async function updateMeetingChoice(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Choice ID");
  const supabase = await createClient();
  const { questionId, meetingId } = await choiceQuestion(supabase, id);
  const { error } = await supabase
    .from("meeting_choices")
    .update({
      choice_text: requiredText(formData.get("choice_text"), "Choice"),
      // Order starts at 1 (2026-11-18).
      display_order: Math.max(1, Math.trunc(Number(formData.get("display_order") ?? 1)) || 1),
    })
    .eq("id", id);

  if (error) {
    backToAgenda(meetingId, "error", error.message, questionId);
  }

  revalidateAdminPaths();
  backToAgenda(meetingId, "success", "Choice updated", questionId);
}

export async function deleteMeetingChoice(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Choice ID");
  const supabase = await createClient();
  const { questionId, meetingId } = await choiceQuestion(supabase, id);
  const { error } = await supabase.from("meeting_choices").delete().eq("id", id);

  if (error) {
    backToAgenda(
      meetingId,
      "error",
      error.code === "23503" ? "This choice has votes and cannot be deleted." : error.message,
      questionId,
    );
  }

  revalidateAdminPaths();
  backToAgenda(meetingId, "success", "Choice deleted", questionId);
}
