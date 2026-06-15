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
