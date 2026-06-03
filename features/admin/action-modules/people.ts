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

  for (const row of importedRows) {
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

    const { data: existingLink, error: existingLinkError } = await supabase
      .from("room_owners")
      .select("id")
      .eq("room_id", roomResult.data.id)
      .eq("owner_id", owner.id)
      .eq("ownership_role", "owner")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingLinkError) {
      throw existingLinkError;
    }

    const currentLink = existingLink?.[0] ?? null;
    const values = {
      room_id: roomResult.data.id,
      owner_id: owner.id,
      ownership_role: "owner",
      starts_at: null,
      ends_at: null,
    };
    const { error } = currentLink
      ? await supabase.from("room_owners").update(values).eq("id", currentLink.id)
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

export async function linkRoomOwner(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("room_owners").insert({
    room_id: requiredText(formData.get("room_id"), "Room"),
    owner_id: requiredText(formData.get("owner_id"), "Owner"),
    ownership_role: requiredText(formData.get("ownership_role"), "Role"),
    starts_at: optionalDate(formData.get("starts_at")),
    ends_at: optionalDate(formData.get("ends_at")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function endRoomOwnerLink(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Room owner link ID");
  const endsAt = optionalDate(formData.get("ends_at")) ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_owners")
    .update({ ends_at: endsAt })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
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
