"use server";

import { withFeedback } from "@/features/admin/action-modules/feedback";
import {
  assertUpsertAction,
  createClient,
  hasImportData,
  optionalNumber,
  optionalText,
  parseBooleanText,
  readExcelSheetUpload,
  requiredNumber,
  requiredText,
  requireOfficeStaff,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import {
  type PeopleActionState,
  type ExcelImportActionState,
  formValues,
  requiredFormText,
  requiredFormNumber,
  validationState,
  databaseErrorState,
  importExcelWithState,
} from "@/features/admin/action-modules/people/helpers";

export async function createRoom(formData: FormData) {
  await requireOfficeStaff();

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({
    room_number: requiredText(formData.get("room_number"), "Room number"),
    floor: optionalText(formData.get("floor")),
    building: optionalText(formData.get("building")),
    area_size: optionalNumber(formData.get("area_size")),
    ownership_percent: requiredNumber(
      formData.get("ownership_percent"),
      "Ownership percentage",
    ),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

async function createRoomFromForm(formData: FormData) {
  await requireOfficeStaff();

  const values = formValues(formData, [
    "room_number",
    "ownership_percent",
    "building",
    "floor",
    "area_size",
  ]);
  const errors: Record<string, string> = {};
  const roomNumber = requiredFormText(
    formData,
    "room_number",
    "Room number",
    errors,
  );
  const ownershipPercent = requiredFormNumber(
    formData,
    "ownership_percent",
    "Ownership percentage",
    errors,
    { max: 100 },
  );
  const validation = validationState(errors, values);

  if (validation) {
    return validation;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({
    room_number: roomNumber,
    floor: optionalText(formData.get("floor")),
    building: optionalText(formData.get("building")),
    area_size: optionalNumber(formData.get("area_size")),
    ownership_percent: ownershipPercent,
  });

  if (error) {
    return databaseErrorState(error, values);
  }

  revalidateAdminPaths();
  return { success: `Room ${roomNumber} created.`, values };
}

export async function createRoomWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  try {
    return await createRoomFromForm(formData);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create room.",
    };
  }
}

export async function updateRoomWithState(
  _state: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  try {
    await requireOfficeStaff();

    const values = formValues(formData, [
      "id",
      "room_number",
      "ownership_percent",
      "building",
      "floor",
      "area_size",
    ]);
    const errors: Record<string, string> = {};
    const id = requiredFormText(formData, "id", "Room ID", errors);
    const roomNumber = requiredFormText(
      formData,
      "room_number",
      "Room number",
      errors,
    );
    const ownershipPercent = requiredFormNumber(
      formData,
      "ownership_percent",
      "Ownership percentage",
      errors,
      { max: 100 },
    );
    const validation = validationState(errors, values);

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("rooms")
      .update({
        room_number: roomNumber,
        floor: optionalText(formData.get("floor")),
        building: optionalText(formData.get("building")),
        area_size: optionalNumber(formData.get("area_size")),
        ownership_percent: ownershipPercent,
      })
      .eq("id", id);

    if (error) {
      return databaseErrorState(error, values);
    }

    revalidateAdminPaths();
    return { success: `Room ${roomNumber} updated.`, values };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update room.",
    };
  }
}

export async function importRoomsExcel(formData: FormData) {
  await requireOfficeStaff();

  const { rows, value } = await readExcelSheetUpload(formData, "Rooms");
  const importedRows = rows
    .filter((row) =>
      hasImportData(row, value, [
        "room_number",
        "ownership_percent",
        "building",
        "floor",
        "area_size",
        "active",
      ]),
    )
    .map((row, index) => {
      assertUpsertAction(row, value, index + 5);
      const ownershipPercent = Number(value(row, "ownership_percent"));

      if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0) {
        throw new Error(
          `Row ${index + 5}: ownership_percent must be greater than 0.`,
        );
      }

      return {
        room_number: requiredText(
          value(row, "room_number"),
          `Row ${index + 5} room_number`,
        ),
        building: value(row, "building"),
        floor: value(row, "floor"),
        area_size: optionalNumber(value(row, "area_size")),
        ownership_percent: ownershipPercent,
        active: parseBooleanText(value(row, "active"), true),
      };
    });

  if (importedRows.length === 0) {
    throw new Error("Excel file has no room rows to upsert.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .upsert(importedRows, { onConflict: "room_number" });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function importRoomsExcelWithState(
  _state: ExcelImportActionState,
  formData: FormData,
): Promise<ExcelImportActionState> {
  return importExcelWithState(formData, importRoomsExcel, "Rooms import completed.");
}

/** Reports the outcome on the same page (admin action standard, 2026-11-19). */
export async function deactivateRoom(formData: FormData) {
  await withFeedback("Room deactivated", () => deactivateRoomNow(formData));
}

async function deactivateRoomNow(formData: FormData) {
  await requireOfficeStaff();

  const id = requiredText(formData.get("id"), "Room ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

/** Reports the outcome on the same page (admin action standard, 2026-11-19). */
export async function reactivateRoom(formData: FormData) {
  await withFeedback("Room reactivated", () => reactivateRoomNow(formData));
}

async function reactivateRoomNow(formData: FormData) {
  await requireOfficeStaff();

  const id = requiredText(formData.get("id"), "Room ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ active: true })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}
