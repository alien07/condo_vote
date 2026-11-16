"use server";

import {
  createClient,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import {
  type PeopleActionState,
  formValues,
} from "@/features/admin/action-modules/people/helpers";

// Database error codes of admin_set_owner_account (migration 0038, D024).
const FIELD_ERRORS: [code: string, field: string, message: string][] = [
  ["OWNER_ACCOUNT_REASON_REQUIRED", "reason", "Give a reason of at least 5 characters."],
  ["OWNER_ACCOUNT_PROFILE_NOT_FOUND", "profile_email", "No account has this email. Ask the owner to sign in once first."],
  ["OWNER_ACCOUNT_PROFILE_REJECTED", "profile_email", "This account was rejected. Change its approval first."],
  ["OWNER_ACCOUNT_PROFILE_TAKEN", "profile_email", "This account is already linked to another owner."],
  ["OWNER_ACCOUNT_SAME", "profile_email", "The owner is already linked to this account."],
];

const SUCCESS: Record<string, string> = {
  "owner.profile_linked": "Owner account linked.",
  "owner.profile_moved": "Owner account moved.",
  "owner.profile_unlinked": "Owner account unlinked.",
};

/** Link, move (intent=link) or unlink (intent=unlink) an owner's account. */
export async function setOwnerAccountWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const values = formValues(formData, ["owner_id", "profile_email", "reason"]);

  try {
    await requireAdmin();

    const unlink = formData.get("intent") === "unlink";
    const ownerId = values.owner_id.trim();
    const email = unlink ? "" : values.profile_email.trim();
    const reason = values.reason.trim();
    const fieldErrors: Record<string, string> = {};

    if (!unlink && !email) {
      fieldErrors.profile_email = "Account email is required.";
    }

    if (reason.length < 5) {
      fieldErrors.reason = "Give a reason of at least 5 characters.";
    }

    if (!ownerId || Object.keys(fieldErrors).length > 0) {
      return {
        error: `Please fix ${Object.keys(fieldErrors).length} field${Object.keys(fieldErrors).length === 1 ? "" : "s"} before saving.`,
        fieldErrors,
        values,
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_owner_account", {
      p_owner_id: ownerId,
      // An empty email unlinks.
      p_profile_email: email,
      p_reason: reason,
    });

    if (error) {
      const match = FIELD_ERRORS.find(([code]) => error.message.includes(code));

      if (match) {
        return {
          error: "Please fix 1 field before saving.",
          fieldErrors: { [match[1]]: match[2] },
          values,
        };
      }

      return { error: error.message, values };
    }

    revalidateAdminPaths();
    const action = (data as { action?: string } | null)?.action ?? "";

    return { success: SUCCESS[action] ?? "Owner account updated.", values: {} };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not change the owner account.",
      values,
    };
  }
}
