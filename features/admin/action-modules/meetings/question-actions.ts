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
    const { data, error } = await supabase
      .from("meeting_questions")
      .insert(questionPayload(values))
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
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

export async function deleteMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Question ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_questions").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function createMeetingChoice(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").insert({
    question_id: requiredText(formData.get("question_id"), "Question"),
    choice_text: requiredText(formData.get("choice_text"), "Choice"),
    display_order: Number(formData.get("display_order") ?? 0),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

/** Edits a choice's text and order (2026-11-18). Draft meetings only:
 * the database refuses others (0039, AGENDA_LOCKED). */
export async function updateMeetingChoice(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_choices")
    .update({
      choice_text: requiredText(formData.get("choice_text"), "Choice"),
      display_order: Number(formData.get("display_order") ?? 0),
    })
    .eq("id", requiredText(formData.get("id"), "Choice ID"));

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function deleteMeetingChoice(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Choice ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
