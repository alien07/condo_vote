"use server";

import { englishGaps, getEnglishMeeting } from "@/features/english/data";
import { getStaffI18n } from "@/lib/i18n/server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalBoolean,
  optionalText,
  requiredDateTime,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { bangkokLocalToIso } from "@/lib/datetime";
import {
  isPassBasis,
  isPassOperator,
  passRuleForPreset,
} from "@/features/results/pass-rules";

export type MeetingActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

export type QuestionActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

const meetingFormFields = [
  "id",
  "title",
  "video_url",
  "meeting_number",
  "meeting_type",
  "fiscal_year",
  "location",
  "chairperson_name",
  "quorum_rule",
  "required_approvals",
  "ballot_secrecy",
  "starts_at",
  "ends_at",
  "advance_starts_at",
  "advance_ends_at",
  "description",
];

function meetingFormValues(formData: FormData) {
  return Object.fromEntries(
    meetingFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

function validateMeetingForm(
  values: Record<string, string>,
  requireId: boolean,
) {
  const fieldErrors: Record<string, string> = {};
  const requiredFields = [
    ["title", "Meeting title"],
    ["meeting_type", "Meeting type"],
    ["quorum_rule", "Quorum rule"],
    ["starts_at", "Start time"],
    ["ends_at", "End time"],
  ] as const;

  if (requireId && !values.id.trim()) {
    fieldErrors.id = "Meeting ID is required.";
  }

  for (const [field, label] of requiredFields) {
    if (!values[field].trim()) {
      fieldErrors[field] = `${label} is required.`;
    }
  }

  const requiredApprovals = Number(values.required_approvals || 1);

  if (!Number.isInteger(requiredApprovals) || requiredApprovals < 1 || requiredApprovals > 20) {
    fieldErrors.required_approvals = "Committee approvals must be a whole number from 1 to 20.";
  }

  if (values.ballot_secrecy && !["open", "secret"].includes(values.ballot_secrecy)) {
    fieldErrors.ballot_secrecy = "Choose open or secret ballot.";
  }

  // Form times are Bangkok time, whatever the server's own time zone is.
  const startsAtIso = bangkokLocalToIso(values.starts_at);
  const endsAtIso = bangkokLocalToIso(values.ends_at);
  const startsAt = values.starts_at ? new Date(startsAtIso ?? "invalid") : null;
  const endsAt = values.ends_at ? new Date(endsAtIso ?? "invalid") : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    fieldErrors.starts_at = "Start time must be a valid date and time.";
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    fieldErrors.ends_at = "End time must be a valid date and time.";
  }

  if (
    startsAt &&
    endsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    startsAt >= endsAt
  ) {
    fieldErrors.ends_at = "End time must be after start time.";
  }

  // Optional advance voting phase: both times or neither, ending before the
  // meeting-day voting starts.
  const advanceStartsIso = bangkokLocalToIso(values.advance_starts_at);
  const advanceEndsIso = bangkokLocalToIso(values.advance_ends_at);

  if (values.advance_starts_at && !advanceStartsIso) {
    fieldErrors.advance_starts_at = "Advance voting start must be a valid date and time.";
  }

  if (values.advance_ends_at && !advanceEndsIso) {
    fieldErrors.advance_ends_at = "Advance voting end must be a valid date and time.";
  }

  if (Boolean(values.advance_starts_at) !== Boolean(values.advance_ends_at)) {
    fieldErrors[values.advance_starts_at ? "advance_ends_at" : "advance_starts_at"] =
      "Set both advance voting times, or leave both empty.";
  } else if (advanceStartsIso && advanceEndsIso) {
    if (advanceStartsIso >= advanceEndsIso) {
      fieldErrors.advance_ends_at = "Advance voting must end after it starts.";
    } else if (startsAtIso && advanceEndsIso > startsAtIso) {
      fieldErrors.advance_ends_at = "Advance voting must end before meeting-day voting starts.";
    }
  }

  return fieldErrors;
}

function meetingValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): MeetingActionState | null {
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

function meetingPayload(values: Record<string, string>) {
  return {
    title: values.title.trim(),
    description: optionalText(values.description),
    video_url: optionalText(values.video_url),
    starts_at: bangkokLocalToIso(values.starts_at)!,
    ends_at: bangkokLocalToIso(values.ends_at)!,
    advance_starts_at: bangkokLocalToIso(values.advance_starts_at),
    advance_ends_at: bangkokLocalToIso(values.advance_ends_at),
    meeting_number: optionalText(values.meeting_number),
    meeting_type: values.meeting_type.trim(),
    fiscal_year: optionalText(values.fiscal_year),
    location: optionalText(values.location),
    chairperson_name: optionalText(values.chairperson_name),
    quorum_rule: values.quorum_rule.trim(),
    required_approvals: Number(values.required_approvals || 1),
    // The field is disabled after publishing (D015), so it is only sent while draft.
    ...(values.ballot_secrecy ? { ballot_secrecy: values.ballot_secrecy } : {}),
  };
}

export async function createMeetingWithState(
  _state: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const values = meetingFormValues(formData);

  try {
    await requireAdmin();
    const validation = meetingValidationState(
      validateMeetingForm(values, false),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meetings")
      .insert(meetingPayload(values))
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Meeting added",
      values,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not add meeting.",
      values,
    };
  }
}

export async function updateDraftMeetingWithState(
  _state: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const values = meetingFormValues(formData);

  try {
    await requireAdmin();
    const validation = meetingValidationState(
      validateMeetingForm(values, true),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("status")
      .eq("id", values.id)
      .single();

    if (meetingError) {
      return { error: meetingError.message, values };
    }

    if (meeting.status !== "draft") {
      return { error: "Only draft meetings can be edited.", values };
    }

    const { error } = await supabase
      .from("meetings")
      .update(meetingPayload(values))
      .eq("id", values.id);

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: values.id,
      success: "Meeting updated",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update meeting.",
      values,
    };
  }
}

const questionFormFields = [
  "id",
  "meeting_id",
  "agenda_no",
  "agenda_title",
  "question_text",
  "question_type",
  "max_choices",
  "resolution_type",
  "required_threshold",
  "pass_basis",
  "pass_operator",
  "pass_percent",
  "display_order",
  "required",
  "requires_land_office_registration",
  "legal_note",
];

function questionFormValues(formData: FormData) {
  return Object.fromEntries(
    questionFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

function validateQuestionForm(
  values: Record<string, string>,
  requireId: boolean,
) {
  const fieldErrors: Record<string, string> = {};
  const requiredFields = [
    ["meeting_id", "Meeting"],
    ["question_text", "Question"],
    ["question_type", "Question type"],
    ["resolution_type", "Resolution type"],
    ["required_threshold", "Required threshold"],
  ] as const;

  if (requireId && !values.id.trim()) {
    fieldErrors.id = "Question ID is required.";
  }

  for (const [field, label] of requiredFields) {
    if (!values[field].trim()) {
      fieldErrors[field] = `${label} is required.`;
    }
  }

  const displayOrder = Number(values.display_order || 0);

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    fieldErrors.display_order = "Order must be a whole number of 0 or greater.";
  }

  if (values.required_threshold === "custom") {
    const percent = Number(values.pass_percent);

    if (!isPassBasis(values.pass_basis ?? "") || values.pass_basis === "none") {
      fieldErrors.pass_basis = "Choose a basis for the custom pass rule.";
    }

    if (!isPassOperator(values.pass_operator ?? "")) {
      fieldErrors.pass_operator = "Choose a comparison for the custom pass rule.";
    }

    if (!values.pass_percent?.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      fieldErrors.pass_percent = "Percent must be between 0 and 100.";
    }
  } else if (values.required_threshold && !passRuleForPreset(values.required_threshold)) {
    fieldErrors.required_threshold = "Choose a pass rule.";
  }

  const maxChoices = values.max_choices?.trim();

  if (maxChoices) {
    const parsed = Number(maxChoices);

    if (!Number.isInteger(parsed) || parsed < 1) {
      fieldErrors.max_choices = "Max choices must be a whole number of 1 or greater.";
    } else if (values.question_type !== "multiple_choice") {
      fieldErrors.max_choices = "Max choices applies to multiple choice questions only.";
    }
  }

  return fieldErrors;
}

function questionValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): QuestionActionState | null {
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

/** Stores the preset's rule, or the custom rule the admin entered (D013). */
function questionPassRule(values: Record<string, string>) {
  const preset = passRuleForPreset(values.required_threshold.trim());

  if (preset) {
    return {
      pass_basis: preset.basis,
      pass_operator: preset.operator,
      pass_percent: preset.percent,
    };
  }

  return {
    pass_basis: values.pass_basis,
    pass_operator: values.pass_operator,
    pass_percent: Number(values.pass_percent),
  };
}

function questionPayload(values: Record<string, string>) {
  return {
    meeting_id: values.meeting_id.trim(),
    agenda_no: optionalText(values.agenda_no),
    agenda_title: optionalText(values.agenda_title),
    question_text: values.question_text.trim(),
    question_type: values.question_type.trim(),
    max_choices:
      values.question_type === "multiple_choice" && values.max_choices?.trim()
        ? Number(values.max_choices)
        : null,
    resolution_type: values.resolution_type.trim(),
    required_threshold: values.required_threshold.trim(),
    ...questionPassRule(values),
    requires_land_office_registration:
      values.requires_land_office_registration === "on",
    legal_note: optionalText(values.legal_note),
    display_order: Number(values.display_order || 0),
    required: values.required === "on",
  };
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

export async function createMeeting(formData: FormData) {
  await requireAdmin();

  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");
  const title = requiredText(formData.get("title"), "Meeting title");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title,
    description: optionalText(formData.get("description")),
    video_url: optionalText(formData.get("video_url")),
    starts_at: startsAt,
    ends_at: endsAt,
    meeting_number: optionalText(formData.get("meeting_number")),
    meeting_type: requiredText(formData.get("meeting_type"), "Meeting type"),
    fiscal_year: optionalText(formData.get("fiscal_year")),
    location: optionalText(formData.get("location")),
    chairperson_name: optionalText(formData.get("chairperson_name")),
    quorum_rule: requiredText(formData.get("quorum_rule"), "Quorum rule"),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
  redirect(
    `/admin/meetings?tab=meetings&title=${encodeURIComponent(title)}&feedback=success&message=${encodeURIComponent("Meeting added")}`,
  );
}

export async function updateDraftMeeting(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Meeting ID");
  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("status")
    .eq("id", id)
    .single();

  if (meetingError) {
    throw meetingError;
  }

  if (meeting.status !== "draft") {
    throw new Error("Only draft meetings can be edited.");
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      title: requiredText(formData.get("title"), "Meeting title"),
      description: optionalText(formData.get("description")),
      video_url: optionalText(formData.get("video_url")),
      starts_at: startsAt,
      ends_at: endsAt,
      meeting_number: optionalText(formData.get("meeting_number")),
      meeting_type: requiredText(formData.get("meeting_type"), "Meeting type"),
      fiscal_year: optionalText(formData.get("fiscal_year")),
      location: optionalText(formData.get("location")),
      chairperson_name: optionalText(formData.get("chairperson_name")),
      quorum_rule: requiredText(formData.get("quorum_rule"), "Quorum rule"),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function archiveMeeting(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
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

export async function publishMeeting(formData: FormData) {
  const admin = await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();

  // Two-language documents (item 6b): English must be filled in and checked
  // before publishing. Checked here, not when saving a draft.
  const { data: condoSettings } = await supabase
    .from("condo_profiles")
    .select("bilingual_documents")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (condoSettings?.bilingual_documents) {
    const englishMeeting = await getEnglishMeeting(meetingId);
    const gaps = englishMeeting ? englishGaps(englishMeeting) : { missing: true, unchecked: true };

    if (gaps.missing || gaps.unchecked) {
      const { s } = await getStaffI18n();
      redirect(
        `/admin/meetings/${meetingId}/english?feedback=error&message=${encodeURIComponent(s.english.publishBlocked)}`,
      );
    }
  }

  const [
    roomsResult,
    profilesResult,
    roomOwnersResult,
    proxyAuthorizationsResult,
  ] = await Promise.all([
    supabase.from("rooms").select("id, ownership_percent").eq("active", true),
    supabase
      .from("profiles")
      .select("id, email, default_status, approval_status")
      .eq("approval_status", "approved"),
    // One owner of record per room (item 15); the oldest link first, so the
    // same owner is picked every time.
    supabase
      .from("room_owners")
      .select("room_id, owners(email)")
      .is("ends_at", null)
      .eq("ownership_role", "owner")
      .order("created_at", { ascending: true }),
    supabase
      .from("proxy_authorizations")
      .select("room_id, proxy_profile_id, rooms(ownership_percent)")
      .eq("meeting_id", meetingId)
      .eq("status", "approved"),
  ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  const profilesByEmail = new Map(
    profilesResult.data.map((profile) => [profile.email.toLowerCase(), profile]),
  );
  const ownershipByRoom = new Map(
    roomsResult.data.map((room) => [room.id, room.ownership_percent]),
  );
  const snapshotRows = new Map<
    string,
    {
      meeting_id: string;
      room_id: string;
      profile_id: string;
      voter_type: string;
      ownership_percent: number;
      source: string;
    }
  >();

  for (const link of roomOwnersResult.data) {
    const ownerEmail = link.owners?.email?.toLowerCase();
    const profile = ownerEmail ? profilesByEmail.get(ownerEmail) : null;
    const ownershipPercent = ownershipByRoom.get(link.room_id);

    if (
      profile?.default_status === "owner" &&
      ownershipPercent &&
      !snapshotRows.has(link.room_id)
    ) {
      snapshotRows.set(link.room_id, {
        meeting_id: meetingId,
        room_id: link.room_id,
        profile_id: profile.id,
        voter_type: "owner",
        ownership_percent: ownershipPercent,
        source: "owner_master",
      });
    }
  }

  for (const authorization of proxyAuthorizationsResult.data) {
    const ownershipPercent = authorization.rooms?.ownership_percent;

    if (ownershipPercent) {
      snapshotRows.set(authorization.room_id, {
        meeting_id: meetingId,
        room_id: authorization.room_id,
        profile_id: authorization.proxy_profile_id,
        voter_type: "proxy",
        ownership_percent: ownershipPercent,
        source: "proxy_authorization",
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("eligible_voters_snapshot")
    .delete()
    .eq("meeting_id", meetingId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = [...snapshotRows.values()];

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("eligible_voters_snapshot")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", meetingId);

  if (meetingError) {
    throw meetingError;
  }

  await writeAuditLog(supabase, {
    action: "meeting.published",
    actorProfileId: admin.id,
    details: {
      eligible_voter_count: rows.length,
    },
    entityId: meetingId,
    entityType: "meeting",
  });
  revalidateAdminPaths();
}
