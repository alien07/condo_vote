"use server";

import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { isSystemAdmin } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n/locales";
import {
  type PeopleActionState,
  formValues,
  requiredFormText,
  validationState,
} from "@/features/admin/action-modules/people/helpers";

export async function updateProfileApproval(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Profile ID");
  const defaultStatus = requiredText(formData.get("default_status"), "Default status");
  const approvalStatus = requiredText(
    formData.get("approval_status"),
    "Approval status",
  );
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      default_status: defaultStatus,
      approval_status: approvalStatus,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "profile.approval_updated",
    actorProfileId: admin.id,
    details: {
      approval_status: approvalStatus,
      default_status: defaultStatus,
    },
    entityId: id,
    entityType: "profile",
  });
  revalidateAdminPaths();
}

export async function updateProfileAccessWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  try {
    const admin = await requireAdmin();
    const values = formValues(formData, [
      "id",
      "default_status",
      "approval_status",
      "preferred_language",
      "role",
    ]);
    const errors: Record<string, string> = {};
    const id = requiredFormText(formData, "id", "Profile ID", errors);
    const preferredLanguage = optionalText(formData.get("preferred_language")) ?? "th";

    if (!isLocale(preferredLanguage)) {
      errors.preferred_language = "Language must be Thai or English.";
    }
    const defaultStatus = requiredFormText(
      formData,
      "default_status",
      "Default status",
      errors,
    );
    const approvalStatus = requiredFormText(
      formData,
      "approval_status",
      "Approval status",
      errors,
    );
    const validation = validationState(errors, values);

    if (validation) {
      return validation;
    }

    const role = optionalText(formData.get("role"));

    if (role === "system_admin" && !(await isSystemAdmin())) {
      return {
        error: "Only a system admin can grant the System admin role.",
        values,
      };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        default_status: defaultStatus,
        approval_status: approvalStatus,
        preferred_language: preferredLanguage,
      })
      .eq("id", id);

    if (error) {
      return { error: error.message, values };
    }

    if (role) {
      const { error: roleError } = await supabase.from("app_roles").upsert(
        { profile_id: id, role },
        { onConflict: "profile_id,role" },
      );

      if (roleError) {
        return { error: roleError.message, values };
      }
    }

    await writeAuditLog(supabase, {
      action: "profile.access_updated",
      actorProfileId: admin.id,
      details: {
        approval_status: approvalStatus,
        default_status: defaultStatus,
        granted_role: role,
        preferred_language: preferredLanguage,
      },
      entityId: id,
      entityType: "profile",
    });
    revalidateAdminPaths();
    return { success: "Profile access updated." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update profile access.",
    };
  }
}

export async function grantAppRole(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("app_roles").upsert(
    {
      profile_id: requiredText(formData.get("profile_id"), "Profile"),
      role: requiredText(formData.get("role"), "Role"),
    },
    { onConflict: "profile_id,role" },
  );

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function revokeAppRole(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Role ID");
  const supabase = await createClient();
  const { data: role, error: roleError } = await supabase
    .from("app_roles")
    .select("profile_id, role")
    .eq("id", id)
    .single();

  if (roleError) {
    throw roleError;
  }

  if (role.profile_id === admin.id && role.role === "admin") {
    throw new Error("Cannot revoke your own admin role.");
  }

  const { error } = await supabase.from("app_roles").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
