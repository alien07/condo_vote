"use server";

import {
  assertUpsertAction,
  createClient,
  hasImportData,
  optionalDate,
  readExcelSheetUpload,
  requiredText,
  requireOfficeStaff,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import {
  type OwnershipActionState,
  type ExcelImportActionState,
  getActiveRoomOwnerLink,
  activeOwnerConflictMessage,
  todayDate,
  ownershipStatus,
  validateOwnershipDateRange,
  ownershipFormValues,
  ownershipValidationState,
  validateOwnershipCreate,
  validateOwnershipDates,
  validateOwnershipEnd,
  importExcelWithState,
} from "@/features/admin/action-modules/people/helpers";

export async function importRoomOwnersExcel(formData: FormData) {
  await requireOfficeStaff();

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

export async function importRoomOwnersExcelWithState(
  _state: ExcelImportActionState,
  formData: FormData,
): Promise<ExcelImportActionState> {
  return importExcelWithState(
    formData,
    importRoomOwnersExcel,
    "Room owners import completed.",
  );
}

async function linkRoomOwnerImpl(formData: FormData) {
  await requireOfficeStaff();

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

  const { data, error } = await supabase
    .from("room_owners")
    .insert({
      room_id: roomId,
      owner_id: ownerId,
      ownership_role: ownershipRole,
      starts_at: startsAt,
      ends_at: endsAt,
      status: ownershipStatus(startsAt, endsAt),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
  return data.id;
}

export async function linkRoomOwner(formData: FormData) {
  await linkRoomOwnerImpl(formData);
}

export async function linkRoomOwnerWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  const values = ownershipFormValues(formData);

  try {
    const validation = ownershipValidationState(
      validateOwnershipCreate(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const recordId = await linkRoomOwnerImpl(formData);

    return { recordId, success: "Ownership link created.", values };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create ownership link.",
      values,
    };
  }
}

async function endRoomOwnerLinkImpl(formData: FormData) {
  const admin = await requireOfficeStaff();

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
  return id;
}

export async function endRoomOwnerLink(formData: FormData) {
  await endRoomOwnerLinkImpl(formData);
}

export async function endRoomOwnerLinkWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  const values = ownershipFormValues(formData);

  try {
    const validation = ownershipValidationState(
      validateOwnershipEnd(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const recordId = await endRoomOwnerLinkImpl(formData);

    return { recordId, success: "Active ownership link ended.", values };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not end ownership link.",
      values,
    };
  }
}

async function updateRoomOwnerDatesImpl(formData: FormData) {
  const admin = await requireOfficeStaff();

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
  return id;
}

export async function updateRoomOwnerDatesWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  const values = ownershipFormValues(formData);

  try {
    const validation = ownershipValidationState(
      validateOwnershipDates(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const recordId = await updateRoomOwnerDatesImpl(formData);

    return { recordId, success: "Ownership dates updated.", values };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update ownership dates.",
      values,
    };
  }
}

async function cancelRoomOwnerLinkImpl(formData: FormData) {
  const admin = await requireOfficeStaff();

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
  return id;
}

export async function cancelRoomOwnerLinkWithState(
  _state: OwnershipActionState,
  formData: FormData,
): Promise<OwnershipActionState> {
  const values = ownershipFormValues(formData);

  try {
    const recordId = await cancelRoomOwnerLinkImpl(formData);

    return { recordId, success: "Scheduled ownership link cancelled.", values };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not cancel scheduled ownership link.",
      values,
    };
  }
}
