"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { isSystemAdmin, requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function acceptPrivacyNotice(formData: FormData) {
  await requireProfile();
  const version = Number(formData.get("notice_version"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_privacy_notice", {
    p_notice_version: version,
  });

  if (error) {
    // The notice changed while the user was reading; show the new one.
    redirect("/consent?changed=1");
  }

  redirect("/");
}

export type PrivacySettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  values?: Record<string, string>;
};

const privacyFields = [
  "consent_required",
  "notice_text",
  "notice_text_en",
  "retention_months_vote_records",
  "retention_months_inactive_profiles",
] as const;

function wholeNumberInRange(value: string, min: number, max: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function savePrivacySettingsWithState(
  _state: PrivacySettingsActionState,
  formData: FormData,
): Promise<PrivacySettingsActionState> {
  const values = Object.fromEntries(
    privacyFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<(typeof privacyFields)[number], string>;

  if (!(await isSystemAdmin())) {
    return { error: "Only a system admin can change privacy settings.", values };
  }

  const fieldErrors: Record<string, string> = {};
  const voteRetention = wholeNumberInRange(values.retention_months_vote_records, 12, 600);
  const profileRetention = wholeNumberInRange(
    values.retention_months_inactive_profiles,
    1,
    600,
  );

  if (!values.notice_text.trim()) {
    fieldErrors.notice_text = "Thai privacy notice is required.";
  }

  if (voteRetention === null) {
    fieldErrors.retention_months_vote_records =
      "Vote record retention must be a whole number of months from 12 to 600.";
  }

  if (profileRetention === null) {
    fieldErrors.retention_months_inactive_profiles =
      "Profile retention must be a whole number of months from 1 to 600.";
  }

  const errorCount = Object.keys(fieldErrors).length;

  if (errorCount > 0) {
    return {
      error: `Please fix ${errorCount} field${errorCount === 1 ? "" : "s"} before saving.`,
      fieldErrors,
      values,
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_settings")
    .update({
      consent_required: values.consent_required === "on",
      notice_text: values.notice_text.trim(),
      notice_text_en: values.notice_text_en.trim() || null,
      retention_months_inactive_profiles: profileRetention!,
      retention_months_vote_records: voteRetention!,
    })
    .eq("id", true)
    .select("notice_version")
    .single();

  if (error) {
    return { error: error.message, values };
  }

  await writeAuditLog(supabase, {
    action: "privacy_settings.updated",
    actorProfileId: profile.id,
    details: { notice_version: data.notice_version },
    entityType: "privacy_settings",
  });
  revalidatePath("/system");

  return {
    success: `Privacy settings saved (notice version ${data.notice_version}).`,
    values,
  };
}
