"use server";

import {
  assertUpsertAction,
  createClient,
  hasImportData,
  optionalText,
  parseBooleanText,
  readExcelSheetUpload,
  requiredText,
  requireOfficeStaff,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import {
  type PeopleActionState,
  type ExcelImportActionState,
  formValues,
  requiredFormText,
  validationState,
  importExcelWithState,
} from "@/features/admin/action-modules/people/helpers";

export async function createOwner(formData: FormData) {
  await requireOfficeStaff();

  const supabase = await createClient();
  const { error } = await supabase.from("owners").insert({
    full_name: requiredText(formData.get("full_name"), "Full name"),
    email: optionalText(formData.get("email")),
    phone: optionalText(formData.get("phone")),
    line_id: optionalText(formData.get("line_id")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

async function createOwnerFromForm(formData: FormData) {
  await requireOfficeStaff();

  const values = formValues(formData, ["full_name", "email", "phone", "line_id"]);
  const errors: Record<string, string> = {};
  const fullName = requiredFormText(formData, "full_name", "Full name", errors);
  const validation = validationState(errors, values);

  if (validation) {
    return validation;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("owners").insert({
    full_name: fullName,
    email: optionalText(formData.get("email")),
    phone: optionalText(formData.get("phone")),
    line_id: optionalText(formData.get("line_id")),
  });

  if (error) {
    return { error: error.message, values };
  }

  revalidateAdminPaths();
  return { success: `Owner ${fullName} created.`, values };
}

export async function createOwnerWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  try {
    return await createOwnerFromForm(formData);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create owner.",
    };
  }
}

export async function updateOwnerWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  try {
    await requireOfficeStaff();

    const values = formValues(formData, [
      "id",
      "full_name",
      "email",
      "phone",
      "line_id",
    ]);
    const errors: Record<string, string> = {};
    const id = requiredFormText(formData, "id", "Owner ID", errors);
    const fullName = requiredFormText(formData, "full_name", "Full name", errors);
    const validation = validationState(errors, values);

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("owners")
      .update({
        full_name: fullName,
        email: optionalText(formData.get("email")),
        phone: optionalText(formData.get("phone")),
        line_id: optionalText(formData.get("line_id")),
      })
      .eq("id", id);

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return { success: `Owner ${fullName} updated.`, values };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update owner.",
    };
  }
}

export async function importOwnersExcel(formData: FormData) {
  await requireOfficeStaff();

  const { rows, value } = await readExcelSheetUpload(formData, "Owners");
  const importedRows = rows
    .filter((row) =>
      hasImportData(row, value, ["full_name", "email", "phone", "line_id", "active"]),
    )
    .map((row, index) => {
      assertUpsertAction(row, value, index + 5);

      return {
        full_name: requiredText(
          value(row, "full_name"),
          `Row ${index + 5} full_name`,
        ),
        email: requiredText(value(row, "email"), `Row ${index + 5} email`)
          .toLowerCase(),
        phone: value(row, "phone"),
        line_id: value(row, "line_id"),
        active: parseBooleanText(value(row, "active"), true),
      };
    });

  if (importedRows.length === 0) {
    throw new Error("Excel file has no owner rows to upsert.");
  }

  const supabase = await createClient();

  for (const row of importedRows) {
    const { data: existingOwner, error: existingOwnerError } = await supabase
      .from("owners")
      .select("id")
      .eq("email", row.email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingOwnerError) {
      throw existingOwnerError;
    }

    const currentOwner = existingOwner?.[0] ?? null;
    const { error } = currentOwner
      ? await supabase.from("owners").update(row).eq("id", currentOwner.id)
      : await supabase.from("owners").insert(row);

    if (error) {
      throw error;
    }
  }

  revalidateAdminPaths();
}

export async function importOwnersExcelWithState(
  _state: ExcelImportActionState,
  formData: FormData,
): Promise<ExcelImportActionState> {
  return importExcelWithState(
    formData,
    importOwnersExcel,
    "Owners import completed.",
  );
}

export async function deactivateOwner(formData: FormData) {
  await requireOfficeStaff();

  const id = requiredText(formData.get("id"), "Owner ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function reactivateOwner(formData: FormData) {
  await requireOfficeStaff();

  const id = requiredText(formData.get("id"), "Owner ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update({ active: true })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
