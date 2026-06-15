"use server";

import {
  assertUpsertAction,
  createClient,
  hasImportData,
  optionalDate,
  optionalNumber,
  optionalText,
  parseBooleanText,
  readExcelSheetUpload,
  requiredNumber,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";

type AdminSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OwnershipActionState = {
  error?: string;
  success?: string;
};

export type PeopleActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  values?: Record<string, string>;
};

function formValues(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

function requiredFormText(
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

function requiredFormNumber(
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

function validationState(
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

function databaseErrorState(
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

  return { error: error.message, values };
}

async function getActiveRoomOwnerLink(
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

function activeOwnerConflictMessage(
  roomNumber: string | null | undefined,
  ownerName: string | null | undefined,
) {
  return `Room ${roomNumber ?? "-"} already has active owner ${ownerName ?? "-"}. End the current active link before creating a new owner link.`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function ownershipStatus(startsAt: string | null, endsAt: string | null) {
  const today = todayDate();

  if (endsAt && endsAt < today) {
    return "ended";
  }

  if (startsAt && startsAt > today) {
    return "scheduled";
  }

  return "active";
}

function validateOwnershipDateRange(
  startsAt: string | null,
  endsAt: string | null,
) {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error("Effective until must be on or after Effective from.");
  }
}

export async function createRoom(formData: FormData) {
  await requireAdmin();

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
  await requireAdmin();

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
    await requireAdmin();

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
  await requireAdmin();

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

export async function deactivateRoom(formData: FormData) {
  await requireAdmin();

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

export async function reactivateRoom(formData: FormData) {
  await requireAdmin();

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

export async function createOwner(formData: FormData) {
  await requireAdmin();

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
  await requireAdmin();

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
    await requireAdmin();

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
  await requireAdmin();

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

export async function importRoomOwnersExcel(formData: FormData) {
  await requireAdmin();

  const { rows, value } = await readExcelSheetUpload(formData, "RoomOwners");
  const importedRows = rows
    .filter((row) => hasImportData(row, value, ["room_number", "owner_email"]))
    .map((row, index) => {
      assertUpsertAction(row, value, index + 5);

      return {
        roomNumber: requiredText(
          value(row, "room_number"),
          `Row ${index + 5} room_number`,
        ),
        ownerEmail: requiredText(
          value(row, "owner_email"),
          `Row ${index + 5} owner_email`,
        ).toLowerCase(),
      };
    });

  if (importedRows.length === 0) {
    throw new Error("Excel file has no room-owner rows to upsert.");
  }

  const supabase = await createClient();

  for (const [rowIndex, row] of importedRows.entries()) {
    const [roomResult, ownerResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id")
        .eq("room_number", row.roomNumber)
        .maybeSingle(),
      supabase
        .from("owners")
        .select("id")
        .eq("email", row.ownerEmail)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (roomResult.error) {
      throw roomResult.error;
    }

    if (ownerResult.error) {
      throw ownerResult.error;
    }

    if (!roomResult.data) {
      throw new Error(`Room "${row.roomNumber}" was not found.`);
    }

    const owner = ownerResult.data?.[0] ?? null;

    if (!owner) {
      throw new Error(`Owner email "${row.ownerEmail}" was not found.`);
    }

    const activeLink = await getActiveRoomOwnerLink(supabase, roomResult.data.id);
    const startsAt = null;
    const endsAt = null;
    const values = {
      room_id: roomResult.data.id,
      owner_id: owner.id,
      ownership_role: "owner",
      starts_at: startsAt,
      ends_at: endsAt,
      status: ownershipStatus(startsAt, endsAt),
    };

    if (activeLink && activeLink.owner_id !== owner.id) {
      throw new Error(
        `Row ${rowIndex + 5}: ${activeOwnerConflictMessage(
          row.roomNumber,
          activeLink.owners?.full_name,
        )}`,
      );
    }

    const { error } = activeLink
      ? await supabase.from("room_owners").update(values).eq("id", activeLink.id)
      : await supabase.from("room_owners").insert(values);

    if (error) {
      throw error;
    }
  }

  revalidateAdminPaths();
}

export async function deactivateOwner(formData: FormData) {
  await requireAdmin();

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
  await requireAdmin();

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

async function linkRoomOwnerImpl(formData: FormData) {
  await requireAdmin();

  const roomId = requiredText(formData.get("room_id"), "Room");
  const ownerId = requiredText(formData.get("owner_id"), "Owner");
  const ownershipRole = requiredText(formData.get("ownership_role"), "Role");
  const startsAt = optionalDate(formData.get("starts_at"));
  const endsAt = optionalDate(formData.get("ends_at"));

  validateOwnershipDateRange(startsAt, endsAt);

  const supabase = await createClient();
  const activeLink = await getActiveRoomOwnerLink(supabase, roomId);

  if (activeLink?.owner_id === ownerId) {
    throw new Error(
      `Room ${activeLink.rooms?.room_number ?? "-"} is already linked to ${activeLink.owners?.full_name ?? "this owner"}.`,
    );
  }

  if (activeLink) {
    throw new Error(
      activeOwnerConflictMessage(
        activeLink.rooms?.room_number,
        activeLink.owners?.full_name,
      ),
    );
  }

  const { error } = await supabase.from("room_owners").insert({
    room_id: roomId,
    owner_id: ownerId,
    ownership_role: ownershipRole,
    starts_at: startsAt,
    ends_at: endsAt,
    status: ownershipStatus(startsAt, endsAt),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function linkRoomOwner(formData: FormData) {
  await linkRoomOwnerImpl(formData);
}

export async function linkRoomOwnerWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  try {
    await linkRoomOwnerImpl(formData);

    return { success: "Ownership link created." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create ownership link.",
    };
  }
}

async function endRoomOwnerLinkImpl(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Room owner link ID");
  const endsAt = optionalDate(formData.get("ends_at")) ?? todayDate();
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from("room_owners")
    .select("id, starts_at, status, room_id, owner_id")
    .eq("id", id)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (link.status === "cancelled") {
    throw new Error("Cancelled ownership links cannot be ended.");
  }

  validateOwnershipDateRange(link.starts_at, endsAt);

  const { error } = await supabase
    .from("room_owners")
    .update({ ends_at: endsAt, status: ownershipStatus(link.starts_at, endsAt) })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "room_owner.ended",
    actorProfileId: admin.id,
    details: {
      ends_at: endsAt,
      owner_id: link.owner_id,
      room_id: link.room_id,
    },
    entityId: id,
    entityType: "room_owner",
  });

  revalidateAdminPaths();
}

export async function endRoomOwnerLink(formData: FormData) {
  await endRoomOwnerLinkImpl(formData);
}

export async function endRoomOwnerLinkWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  try {
    await endRoomOwnerLinkImpl(formData);

    return { success: "Active ownership link ended." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not end ownership link.",
    };
  }
}

async function updateRoomOwnerDatesImpl(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Room owner link ID");
  const startsAt = optionalDate(formData.get("starts_at"));
  const endsAt = optionalDate(formData.get("ends_at"));

  validateOwnershipDateRange(startsAt, endsAt);

  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from("room_owners")
    .select("id, status, room_id, owner_id")
    .eq("id", id)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (link.status === "cancelled") {
    throw new Error("Cancelled ownership links cannot be edited.");
  }

  const { error } = await supabase
    .from("room_owners")
    .update({
      starts_at: startsAt,
      ends_at: endsAt,
      status: ownershipStatus(startsAt, endsAt),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "room_owner.dates_updated",
    actorProfileId: admin.id,
    details: {
      ends_at: endsAt,
      owner_id: link.owner_id,
      room_id: link.room_id,
      starts_at: startsAt,
    },
    entityId: id,
    entityType: "room_owner",
  });

  revalidateAdminPaths();
}

export async function updateRoomOwnerDatesWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  try {
    await updateRoomOwnerDatesImpl(formData);

    return { success: "Ownership dates updated." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update ownership dates.",
    };
  }
}

async function cancelRoomOwnerLinkImpl(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Room owner link ID");
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from("room_owners")
    .select("id, starts_at, status, room_id, owner_id")
    .eq("id", id)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (link.status === "cancelled") {
    throw new Error("Ownership link is already cancelled.");
  }

  if (ownershipStatus(link.starts_at, null) !== "scheduled") {
    throw new Error("Only scheduled ownership links can be cancelled.");
  }

  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("room_owners")
    .update({
      cancelled_at: cancelledAt,
      cancelled_by: admin.id,
      status: "cancelled",
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "room_owner.cancelled",
    actorProfileId: admin.id,
    details: {
      cancelled_at: cancelledAt,
      owner_id: link.owner_id,
      room_id: link.room_id,
    },
    entityId: id,
    entityType: "room_owner",
  });

  revalidateAdminPaths();
}

export async function cancelRoomOwnerLinkWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  try {
    await cancelRoomOwnerLinkImpl(formData);

    return { success: "Scheduled ownership link cancelled." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not cancel scheduled ownership link.",
    };
  }
}

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
      "role",
    ]);
    const errors: Record<string, string> = {};
    const id = requiredFormText(formData, "id", "Profile ID", errors);
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
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        default_status: defaultStatus,
        approval_status: approvalStatus,
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
