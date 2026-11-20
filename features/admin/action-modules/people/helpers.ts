import {
  createClient,
  optionalDate,
  optionalText,
} from "@/features/admin/action-modules/shared";

export type AdminSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OwnershipActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

export type PeopleActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  values?: Record<string, string>;
};

export type ExcelImportActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export function formValues(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

export function requiredFormText(
  formData: FormData,
  fieldName: string,
  label: string,
  errors: Record<string, string>,
) {
  const value = optionalText(formData.get(fieldName));

  if (!value) {
    errors[fieldName] = `${label} is required.`;
  }

  return value ?? "";
}

export function requiredFormNumber(
  formData: FormData,
  fieldName: string,
  label: string,
  errors: Record<string, string>,
  options?: { max?: number },
) {
  const rawValue = String(formData.get(fieldName) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue) {
    errors[fieldName] = `${label} is required.`;
    return 0;
  }

  if (!Number.isFinite(value) || value <= 0) {
    errors[fieldName] = `${label} must be greater than 0.`;
    return 0;
  }

  if (options?.max !== undefined && value > options.max) {
    errors[fieldName] = `${label} must be between 0 and ${options.max}.`;
    return value;
  }

  return value;
}

export function validationState(
  errors: Record<string, string>,
  values?: Record<string, string>,
): PeopleActionState | null {
  if (Object.keys(errors).length === 0) {
    return null;
  }

  return {
    error: `Please fix ${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? "" : "s"} before saving.`,
    fieldErrors: errors,
    values,
  };
}

export function databaseErrorState(
  error: { message: string },
  values: Record<string, string>,
): PeopleActionState {
  if (error.message.includes("rooms_ownership_percent_range")) {
    return {
      error: "Please fix 1 field before saving.",
      fieldErrors: {
        ownership_percent: "Ownership percentage must be between 0 and 100.",
      },
      values,
    };
  }

  // Owner email rules (D024).
  if (error.message.includes("owners_active_email_key")) {
    return {
      error: "Please fix 1 field before saving.",
      fieldErrors: { email: "Another active owner already uses this email." },
      values,
    };
  }

  if (error.message.includes("OWNER_EMAIL_ADMIN_ONLY")) {
    return {
      error: "Please fix 1 field before saving.",
      fieldErrors: { email: "Only the Manager can change an owner's email." },
      values,
    };
  }

  return { error: error.message, values };
}

export async function getActiveRoomOwnerLink(
  supabase: AdminSupabaseClient,
  roomId: string,
) {
  const { data, error } = await supabase
    .from("room_owners")
    .select("id, room_id, owner_id, rooms(room_number), owners(full_name, email)")
    .eq("room_id", roomId)
    .is("ends_at", null)
    .neq("status", "cancelled")
    .limit(2);

  if (error) {
    throw error;
  }

  if ((data?.length ?? 0) > 1) {
    throw new Error(
      "This room has more than one active owner link. End duplicate links before creating a new ownership link.",
    );
  }

  return data?.[0] ?? null;
}

export function activeOwnerConflictMessage(
  roomNumber: string | null | undefined,
  ownerName: string | null | undefined,
) {
  return `Room ${roomNumber ?? "-"} already has active owner ${ownerName ?? "-"}. End the current active link before creating a new owner link.`;
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ownershipStatus(startsAt: string | null, endsAt: string | null) {
  const today = todayDate();

  if (endsAt && endsAt < today) {
    return "ended";
  }

  if (startsAt && startsAt > today) {
    return "scheduled";
  }

  return "active";
}

export function validateOwnershipDateRange(
  startsAt: string | null,
  endsAt: string | null,
) {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error("Effective until must be on or after Effective from.");
  }
}

export function ownershipFormValues(formData: FormData) {
  return formValues(formData, [
    "id",
    "room_id",
    "owner_id",
    "ownership_role",
    "starts_at",
    "ends_at",
  ]);
}

export function ownershipValidationState(
  errors: Record<string, string>,
  values: Record<string, string>,
): OwnershipActionState | null {
  const count = Object.keys(errors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors: errors,
    values,
  };
}

export function validateOwnershipCreate(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  (
    [
      ["room_id", "Room"],
      ["owner_id", "Owner"],
      ["ownership_role", "Ownership role"],
    ] as const
  ).forEach(([field, label]) => {
    if (!values[field]?.trim()) {
      fieldErrors[field] = `${label} is required.`;
    }
  });

  try {
    validateOwnershipDateRange(
      optionalDate(values.starts_at),
      optionalDate(values.ends_at),
    );
  } catch (error) {
    fieldErrors.ends_at =
      error instanceof Error
        ? error.message
        : "Effective until must be on or after Effective from.";
  }

  return fieldErrors;
}

export function validateOwnershipDates(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!values.id?.trim()) {
    fieldErrors.id = "Room owner link ID is required.";
  }

  try {
    validateOwnershipDateRange(
      optionalDate(values.starts_at),
      optionalDate(values.ends_at),
    );
  } catch (error) {
    fieldErrors.ends_at =
      error instanceof Error
        ? error.message
        : "Effective until must be on or after Effective from.";
  }

  return fieldErrors;
}

export function validateOwnershipEnd(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!values.id?.trim()) {
    fieldErrors.id = "Room owner link ID is required.";
  }

  if (!values.ends_at?.trim()) {
    fieldErrors.ends_at = "End date is required.";
  }

  return fieldErrors;
}

export function validateExcelUpload(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      error: "Please choose an Excel file before uploading.",
      fieldErrors: {
        file: "Excel file is required.",
      },
    };
  }

  return null;
}

export async function importExcelWithState(
  formData: FormData,
  importAction: (formData: FormData) => Promise<void>,
  success: string,
): Promise<ExcelImportActionState> {
  const validation = validateExcelUpload(formData);

  if (validation) {
    return validation;
  }

  try {
    await importAction(formData);
    return { success };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not import Excel file.",
    };
  }
}
