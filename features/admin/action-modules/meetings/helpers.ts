import { optionalText } from "@/features/admin/action-modules/shared";
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

export const meetingFormFields = [
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

export function meetingFormValues(formData: FormData) {
  return Object.fromEntries(
    meetingFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

export function validateMeetingForm(
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

  // Fiscal year is a 4-digit year, for example 2569 (2026-11-18).
  if (values.fiscal_year && !/^\d{4}$/.test(values.fiscal_year.trim())) {
    fieldErrors.fiscal_year = "Fiscal year must be a 4-digit year, for example 2569.";
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

export function meetingValidationState(
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

export function meetingPayload(values: Record<string, string>) {
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

export const questionFormFields = [
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
  "allow_comment",
  "legal_note",
];

export function questionFormValues(formData: FormData) {
  return Object.fromEntries(
    questionFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

export function validateQuestionForm(
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

export function questionValidationState(
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
export function questionPassRule(values: Record<string, string>) {
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

export function questionPayload(values: Record<string, string>) {
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
    // Voters may add a comment (0040).
    allow_comment: values.allow_comment === "on",
  };
}
