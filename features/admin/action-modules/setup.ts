"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalDate,
  optionalText,
  requiredIntegerInRange,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";

export type CommitteeActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

export async function saveCondoProfile(formData: FormData) {
  await requireAdmin();

  const id = optionalText(formData.get("id"));
  const values = {
    juristic_name: requiredText(formData.get("juristic_name"), "Juristic name"),
    project_name: requiredText(formData.get("project_name"), "Project name"),
    registration_no: optionalText(formData.get("registration_no")),
    tax_id: optionalText(formData.get("tax_id")),
    address: optionalText(formData.get("address")),
    phone: optionalText(formData.get("phone")),
    email: optionalText(formData.get("email")),
    manager_name: optionalText(formData.get("manager_name")),
    document_footer: optionalText(formData.get("document_footer")),
    summary_history_limit: requiredIntegerInRange(
      formData.get("summary_history_limit"),
      "Summary history limit",
      1,
      20,
    ),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("condo_profiles").update(values).eq("id", id)
    : await supabase.from("condo_profiles").insert(values);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

const committeeFormFields = [
  "id",
  "profile_id",
  "full_name",
  "position_title",
  "display_order",
  "term_starts_at",
  "term_ends_at",
  "active",
];

function committeeFormValues(formData: FormData) {
  return Object.fromEntries(
    committeeFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

function validateCommitteeForm(
  values: Record<string, string>,
  requireId: boolean,
) {
  const fieldErrors: Record<string, string> = {};

  if (requireId && !values.id.trim()) {
    fieldErrors.id = "Committee member ID is required.";
  }

  if (!values.full_name.trim()) {
    fieldErrors.full_name = "Committee name is required.";
  }

  if (!values.position_title.trim()) {
    fieldErrors.position_title = "Position is required.";
  }

  const displayOrder = Number(values.display_order || 0);

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    fieldErrors.display_order = "Display order must be a whole number of 0 or greater.";
  }

  if (
    values.term_starts_at &&
    values.term_ends_at &&
    values.term_starts_at > values.term_ends_at
  ) {
    fieldErrors.term_ends_at = "Term ends must be on or after term starts.";
  }

  return fieldErrors;
}

function committeeValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): CommitteeActionState | null {
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

function committeePayload(values: Record<string, string>, active: boolean) {
  return {
    profile_id: optionalText(values.profile_id),
    full_name: values.full_name.trim(),
    position_title: values.position_title.trim(),
    term_starts_at: values.term_starts_at || null,
    term_ends_at: values.term_ends_at || null,
    display_order: Number(values.display_order || 0),
    active,
  };
}

export async function createCommitteeMemberWithState(
  _state: CommitteeActionState,
  formData: FormData,
): Promise<CommitteeActionState> {
  const values = committeeFormValues(formData);

  try {
    await requireAdmin();
    const validation = committeeValidationState(
      validateCommitteeForm(values, false),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("committee_members")
      .insert(committeePayload(values, true))
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Committee member added",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not add committee member.",
      values,
    };
  }
}

export async function updateCommitteeMemberWithState(
  _state: CommitteeActionState,
  formData: FormData,
): Promise<CommitteeActionState> {
  const values = committeeFormValues(formData);

  try {
    await requireAdmin();
    const validation = committeeValidationState(
      validateCommitteeForm(values, true),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("committee_members")
      .update(committeePayload(values, values.active === "on"))
      .eq("id", values.id)
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Committee member updated",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update committee member.",
      values,
    };
  }
}

export async function createCommitteeMember(formData: FormData) {
  await requireAdmin();

  const profileId = optionalText(formData.get("profile_id"));
  const fullName = requiredText(formData.get("full_name"), "Full name");
  const supabase = await createClient();
  const { error } = await supabase.from("committee_members").insert({
    profile_id: profileId,
    full_name: fullName,
    position_title: requiredText(formData.get("position_title"), "Position"),
    term_starts_at: optionalDate(formData.get("term_starts_at")),
    term_ends_at: optionalDate(formData.get("term_ends_at")),
    display_order: Number(formData.get("display_order") ?? 0),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
  redirect(
    `/admin/setup?tab=committee&memberName=${encodeURIComponent(
      fullName,
    )}&feedback=success&message=Committee%20member%20added`,
  );
}

export async function updateCommitteeMember(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Committee member ID");
  const profileId = optionalText(formData.get("profile_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("committee_members")
    .update({
      profile_id: profileId,
      full_name: requiredText(formData.get("full_name"), "Full name"),
      position_title: requiredText(formData.get("position_title"), "Position"),
      term_starts_at: optionalDate(formData.get("term_starts_at")),
      term_ends_at: optionalDate(formData.get("term_ends_at")),
      display_order: Number(formData.get("display_order") ?? 0),
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function deactivateCommitteeMember(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Committee member ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("committee_members")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function reactivateCommitteeMember(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Committee member ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("committee_members")
    .update({ active: true })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
