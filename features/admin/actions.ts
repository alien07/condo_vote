"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  return text ? Number(text) : null;
}

function requiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

function parseBooleanText(value: string | null, defaultValue = true) {
  if (value === null || value === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "yes", "y", "1", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "inactive"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid active value "${value}". Use true or false.`);
}

function hasImportData(
  row: string[],
  value: (row: string[], header: string) => string | null,
  headers: string[],
) {
  return headers.some((header) => header !== "import_action" && value(row, header));
}

function assertUpsertAction(
  row: string[],
  value: (row: string[], header: string) => string | null,
  rowNumber: number,
) {
  const action = (value(row, "import_action") ?? "upsert").toLowerCase();

  if (action !== "upsert") {
    throw new Error(
      `Row ${rowNumber}: only upsert is allowed. Delete master data from the edit menu.`,
    );
  }
}

function requiredDateTime(value: FormDataEntryValue | null, fieldName: string) {
  const text = requiredText(value, fieldName);
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date and time.`);
  }

  return date.toISOString();
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return text;
}

function optionalBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function revalidateAdminPaths() {
  revalidatePath("/admin", "layout");
}

async function readExcelSheetUpload(formData: FormData, sheetName: string) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Excel file is required.");
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Upload must be an .xlsx file from the Excel template.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" is required.`);
  }

  const rawRows: string[][] = [];

  worksheet.eachRow({ includeEmpty: false }, (excelRow) => {
    const values = Array.isArray(excelRow.values) ? excelRow.values.slice(1) : [];
    rawRows.push(values.map((value) => String(value ?? "").trim()));
  });
  const headerRowIndex = rawRows.findIndex((row) =>
    row.some((value) => String(value).trim().toLowerCase() === "import_action"),
  );

  if (headerRowIndex === -1) {
    throw new Error(`Sheet "${sheetName}" does not match the import template.`);
  }

  const headers = rawRows[headerRowIndex].map((header) => String(header).trim());
  const rows = rawRows
    .slice(headerRowIndex + 1)
    .map((row) => headers.map((_, index) => String(row[index] ?? "").trim()))
    .filter((row) => row.some((value) => value !== ""));
  const headerIndex = new Map(
    headers.map((header, index) => [header.trim().toLowerCase(), index]),
  );

  return {
    rows,
    value(row: string[], header: string) {
      const index = headerIndex.get(header);
      return index === undefined ? null : row[index]?.trim() || null;
    },
  };
}

async function queueResultApprovedEmails(meetingId: string) {
  const supabase = await createClient();
  const [ownersResult, residentsResult, existingLogsResult] = await Promise.all([
    supabase
      .from("owners")
      .select("email, created_at")
      .eq("active", true)
      .not("email", "is", null),
    supabase
      .from("profiles")
      .select("email, created_at")
      .eq("approval_status", "approved")
      .eq("default_status", "resident"),
    supabase
      .from("email_logs")
      .select("recipient_email")
      .eq("template_key", `result_approved:${meetingId}`),
  ]);

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (residentsResult.error) {
    throw residentsResult.error;
  }

  if (existingLogsResult.error) {
    throw existingLogsResult.error;
  }

  const existingRecipients = new Set(
    existingLogsResult.data.map((log) => log.recipient_email.toLowerCase()),
  );
  const recipientsByEmail = new Map<
    string,
    {
      email: string;
      activeAt: string;
    }
  >();

  for (const owner of ownersResult.data) {
    const email = owner.email?.trim().toLowerCase();

    if (email) {
      recipientsByEmail.set(email, {
        email,
        activeAt: owner.created_at,
      });
    }
  }

  for (const resident of residentsResult.data) {
    const email = resident.email.trim().toLowerCase();
    const current = recipientsByEmail.get(email);

    if (!current || current.activeAt < resident.created_at) {
      recipientsByEmail.set(email, {
        email,
        activeAt: resident.created_at,
      });
    }
  }

  const rows = [...recipientsByEmail.values()]
    .filter((recipient) => !existingRecipients.has(recipient.email))
    .sort((left, right) => right.activeAt.localeCompare(left.activeAt))
    .map((recipient) => ({
      recipient_email: recipient.email,
      template_key: `result_approved:${meetingId}`,
      status: "queued",
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("email_logs").insert(rows);

  if (error) {
    throw error;
  }
}

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
  const supabase = await createClient();
  const { error } = await supabase.from("committee_members").insert({
    profile_id: profileId,
    full_name: requiredText(formData.get("full_name"), "Full name"),
    position_title: requiredText(formData.get("position_title"), "Position"),
    term_starts_at: optionalDate(formData.get("term_starts_at")),
    term_ends_at: optionalDate(formData.get("term_ends_at")),
    display_order: Number(formData.get("display_order") ?? 0),
  });

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

export async function createMeeting(formData: FormData) {
  await requireAdmin();

  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title: requiredText(formData.get("title"), "Meeting title"),
    description: optionalText(formData.get("description")),
    video_url: optionalText(formData.get("video_url")),
    starts_at: startsAt,
    ends_at: endsAt,
    meeting_number: optionalText(formData.get("meeting_number")),
    meeting_type: requiredText(formData.get("meeting_type"), "Meeting type"),
    fiscal_year: optionalText(formData.get("fiscal_year")),
    location: optionalText(formData.get("location")),
    chairperson_name: optionalText(formData.get("chairperson_name")),
    quorum_rule: requiredText(formData.get("quorum_rule"), "Quorum rule"),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function archiveMeeting(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "archived" })
    .eq("id", id);

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
  await requireAdmin();

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

export async function createProxyAuthorization(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("proxy_authorizations").insert({
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    room_id: requiredText(formData.get("room_id"), "Room"),
    owner_id: optionalText(formData.get("owner_id")),
    proxy_profile_id: requiredText(formData.get("proxy_profile_id"), "Proxy profile"),
    valid_from: optionalDate(formData.get("valid_from")),
    valid_until: optionalDate(formData.get("valid_until")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function reviewProxyAuthorization(formData: FormData) {
  const reviewer = await requireAdmin();

  const id = requiredText(formData.get("id"), "Proxy authorization ID");
  const status = requiredText(formData.get("status"), "Status");
  const supabase = await createClient();
  const { error } = await supabase
    .from("proxy_authorizations")
    .update({
      status,
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function createMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_questions").insert({
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    agenda_no: optionalText(formData.get("agenda_no")),
    agenda_title: optionalText(formData.get("agenda_title")),
    question_text: requiredText(formData.get("question_text"), "Question"),
    question_type: requiredText(formData.get("question_type"), "Question type"),
    resolution_type: requiredText(
      formData.get("resolution_type"),
      "Resolution type",
    ),
    required_threshold: requiredText(
      formData.get("required_threshold"),
      "Required threshold",
    ),
    requires_land_office_registration: optionalBoolean(
      formData.get("requires_land_office_registration"),
    ),
    legal_note: optionalText(formData.get("legal_note")),
    display_order: Number(formData.get("display_order") ?? 0),
    required: optionalBoolean(formData.get("required")),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function deleteMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Question ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_questions").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function createMeetingChoice(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").insert({
    question_id: requiredText(formData.get("question_id"), "Question"),
    choice_text: requiredText(formData.get("choice_text"), "Choice"),
    display_order: Number(formData.get("display_order") ?? 0),
  });

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function deleteMeetingChoice(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Choice ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function importManualVoteEntry(formData: FormData) {
  const importer = await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const questionId = requiredText(formData.get("question_id"), "Question");
  const choiceId = requiredText(formData.get("choice_id"), "Choice");
  const supabase = await createClient();
  const [questionResult, choiceResult] = await Promise.all([
    supabase
      .from("meeting_questions")
      .select("id")
      .eq("id", questionId)
      .eq("meeting_id", meetingId)
      .single(),
    supabase
      .from("meeting_choices")
      .select("id")
      .eq("id", choiceId)
      .eq("question_id", questionId)
      .single(),
  ]);

  if (questionResult.error) {
    throw questionResult.error;
  }

  if (choiceResult.error) {
    throw choiceResult.error;
  }

  const { data: manualBallot, error: manualBallotError } = await supabase
    .from("manual_ballots")
    .upsert(
      {
        meeting_id: meetingId,
        room_id: roomId,
        source_label: optionalText(formData.get("source_label")),
        audit_note: optionalText(formData.get("audit_note")),
        imported_by: importer.id,
        status: "submitted",
      },
      { onConflict: "meeting_id,room_id" },
    )
    .select("id")
    .single();

  if (manualBallotError) {
    throw manualBallotError;
  }

  const { error: answerError } = await supabase
    .from("manual_ballot_answers")
    .upsert(
      {
        manual_ballot_id: manualBallot.id,
        question_id: questionId,
        choice_id: choiceId,
      },
      { onConflict: "manual_ballot_id,question_id" },
    );

  if (answerError) {
    throw answerError;
  }

  revalidateAdminPaths();
}

export async function resolveVoteSourceConflict(formData: FormData) {
  const resolver = await requireAdmin();

  const chosenSource = requiredText(formData.get("chosen_source"), "Chosen source");
  const onlineBallotId = requiredText(
    formData.get("online_ballot_id"),
    "Online ballot",
  );
  const manualBallotId = requiredText(
    formData.get("manual_ballot_id"),
    "Manual ballot",
  );
  const chosenBallotId =
    chosenSource === "online" ? onlineBallotId : manualBallotId;
  const supabase = await createClient();
  const { error } = await supabase.from("vote_source_resolutions").upsert(
    {
      meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
      room_id: requiredText(formData.get("room_id"), "Room"),
      online_ballot_id: onlineBallotId,
      manual_ballot_id: manualBallotId,
      chosen_source: chosenSource,
      chosen_ballot_id: chosenBallotId,
      conflict_remark: optionalText(formData.get("conflict_remark")),
      resolved_by: resolver.id,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,room_id" },
  );

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
}

export async function publishMeeting(formData: FormData) {
  await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();

  const [
    roomsResult,
    profilesResult,
    roomOwnersResult,
    proxyAuthorizationsResult,
  ] = await Promise.all([
    supabase.from("rooms").select("id, ownership_percent").eq("active", true),
    supabase
      .from("profiles")
      .select("id, email, default_status, approval_status")
      .eq("approval_status", "approved"),
    supabase
      .from("room_owners")
      .select("room_id, owners(email)")
      .is("ends_at", null),
    supabase
      .from("proxy_authorizations")
      .select("room_id, proxy_profile_id, rooms(ownership_percent)")
      .eq("meeting_id", meetingId)
      .eq("status", "approved"),
  ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  const profilesByEmail = new Map(
    profilesResult.data.map((profile) => [profile.email.toLowerCase(), profile]),
  );
  const ownershipByRoom = new Map(
    roomsResult.data.map((room) => [room.id, room.ownership_percent]),
  );
  const snapshotRows = new Map<
    string,
    {
      meeting_id: string;
      room_id: string;
      profile_id: string;
      voter_type: string;
      ownership_percent: number;
      source: string;
    }
  >();

  for (const link of roomOwnersResult.data) {
    const ownerEmail = link.owners?.email?.toLowerCase();
    const profile = ownerEmail ? profilesByEmail.get(ownerEmail) : null;
    const ownershipPercent = ownershipByRoom.get(link.room_id);

    if (
      profile?.default_status === "owner" &&
      ownershipPercent &&
      !snapshotRows.has(link.room_id)
    ) {
      snapshotRows.set(link.room_id, {
        meeting_id: meetingId,
        room_id: link.room_id,
        profile_id: profile.id,
        voter_type: "owner",
        ownership_percent: ownershipPercent,
        source: "owner_master",
      });
    }
  }

  for (const authorization of proxyAuthorizationsResult.data) {
    const ownershipPercent = authorization.rooms?.ownership_percent;

    if (ownershipPercent) {
      snapshotRows.set(authorization.room_id, {
        meeting_id: meetingId,
        room_id: authorization.room_id,
        profile_id: authorization.proxy_profile_id,
        voter_type: "proxy",
        ownership_percent: ownershipPercent,
        source: "proxy_authorization",
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("eligible_voters_snapshot")
    .delete()
    .eq("meeting_id", meetingId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = [...snapshotRows.values()];

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("eligible_voters_snapshot")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", meetingId);

  if (meetingError) {
    throw meetingError;
  }

  revalidateAdminPaths();
}

export async function generateResultSnapshot(formData: FormData) {
  const generator = await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();
  const { data: existingApproval, error: existingApprovalError } = await supabase
    .from("committee_approvals")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (existingApprovalError) {
    throw existingApprovalError;
  }

  if (existingApproval) {
    throw new Error("Cannot generate a new result after committee approval.");
  }

  const [
    meetingResult,
    questionsResult,
    eligibleResult,
    ballotsResult,
    manualBallotsResult,
    voteSourceResolutionsResult,
  ] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule",
        )
        .eq("id", meetingId)
        .single(),
      supabase
        .from("meeting_questions")
        .select(
          "id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, requires_land_office_registration, legal_note, display_order, meeting_choices(id, choice_text, display_order)",
        )
        .eq("meeting_id", meetingId)
        .order("display_order", { ascending: true }),
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", meetingId),
      supabase
        .from("ballots")
        .select("id, room_id, status, ballot_answers(question_id, choice_id)")
        .eq("meeting_id", meetingId)
        .eq("status", "submitted"),
      supabase
        .from("manual_ballots")
        .select(
          "id, room_id, source_label, audit_note, manual_ballot_answers(question_id, choice_id)",
        )
        .eq("meeting_id", meetingId),
      supabase
        .from("vote_source_resolutions")
        .select(
          "room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at",
        )
        .eq("meeting_id", meetingId),
    ]);

  if (meetingResult.error) {
    throw meetingResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (eligibleResult.error) {
    throw eligibleResult.error;
  }

  if (ballotsResult.error) {
    throw ballotsResult.error;
  }

  if (manualBallotsResult.error) {
    throw manualBallotsResult.error;
  }

  if (voteSourceResolutionsResult.error) {
    throw voteSourceResolutionsResult.error;
  }

  const ownershipByRoom = new Map(
    eligibleResult.data.map((eligible) => [
      eligible.room_id,
      toNumber(eligible.ownership_percent),
    ]),
  );
  const onlineBallotByRoom = new Map(
    ballotsResult.data.map((ballot) => [ballot.room_id, ballot]),
  );
  const manualBallotByRoom = new Map(
    manualBallotsResult.data.map((manualBallot) => [
      manualBallot.room_id,
      manualBallot,
    ]),
  );
  const onlineRoomIds = new Set(onlineBallotByRoom.keys());
  const manualRoomIds = new Set(manualBallotByRoom.keys());
  const resolutionByRoom = new Map(
    voteSourceResolutionsResult.data.map((resolution) => [
      resolution.room_id,
      resolution,
    ]),
  );
  const conflicts = [...manualRoomIds]
    .filter((roomId) => onlineRoomIds.has(roomId))
    .map((roomId) => {
      const onlineBallot = onlineBallotByRoom.get(roomId);
      const manualBallot = manualBallotByRoom.get(roomId);
      const resolution = resolutionByRoom.get(roomId);
      const matchingResolution =
        resolution &&
        onlineBallot &&
        manualBallot &&
        resolution.online_ballot_id === onlineBallot.id &&
        resolution.manual_ballot_id === manualBallot.id
          ? resolution
          : null;

      return {
        room_id: roomId,
        online_ballot_id: onlineBallot?.id ?? null,
        manual_ballot_id: manualBallot?.id ?? null,
        resolution: matchingResolution,
      };
    });
  const unresolvedConflicts = conflicts.filter((conflict) => !conflict.resolution);

  if (unresolvedConflicts.length > 0) {
    throw new Error(
      `Resolve ${unresolvedConflicts.length} manual/online vote conflict(s) before generating results.`,
    );
  }

  const effectiveRoomSources = new Map<string, "online" | "manual">();

  for (const roomId of onlineRoomIds) {
    effectiveRoomSources.set(roomId, "online");
  }

  for (const roomId of manualRoomIds) {
    effectiveRoomSources.set(roomId, "manual");
  }

  for (const conflict of conflicts) {
    effectiveRoomSources.set(
      conflict.room_id,
      conflict.resolution?.chosen_source === "online" ? "online" : "manual",
    );
  }

  const submittedRoomIds = new Set(effectiveRoomSources.keys());
  const totalEligibleOwnership = [...ownershipByRoom.values()].reduce(
    (sum, ownership) => sum + ownership,
    0,
  );
  const submittedOwnership = [...submittedRoomIds].reduce(
    (sum, roomId) => sum + (ownershipByRoom.get(roomId) ?? 0),
    0,
  );
  const countsByChoice = new Map<
    string,
    {
      voteCount: number;
      ownership: number;
    }
  >();

  for (const ballot of ballotsResult.data) {
    if (effectiveRoomSources.get(ballot.room_id) !== "online") {
      continue;
    }

    const ownership = ownershipByRoom.get(ballot.room_id) ?? 0;

    for (const answer of ballot.ballot_answers) {
      const current = countsByChoice.get(answer.choice_id) ?? {
        voteCount: 0,
        ownership: 0,
      };

      countsByChoice.set(answer.choice_id, {
        voteCount: current.voteCount + 1,
        ownership: current.ownership + ownership,
      });
    }
  }

  for (const manualBallot of manualBallotsResult.data) {
    if (effectiveRoomSources.get(manualBallot.room_id) !== "manual") {
      continue;
    }

    const ownership = ownershipByRoom.get(manualBallot.room_id) ?? 0;

    for (const answer of manualBallot.manual_ballot_answers) {
      const current = countsByChoice.get(answer.choice_id) ?? {
        voteCount: 0,
        ownership: 0,
      };

      countsByChoice.set(answer.choice_id, {
        voteCount: current.voteCount + 1,
        ownership: current.ownership + ownership,
      });
    }
  }

  const payload = {
    meeting: meetingResult.data,
    generated_at: new Date().toISOString(),
    totals: {
      eligible_voters: eligibleResult.data.length,
      submitted_ballots: submittedRoomIds.size,
      online_ballots: ballotsResult.data.length,
      manual_ballots: manualBallotsResult.data.length,
      effective_vote_rooms: submittedRoomIds.size,
      total_eligible_ownership: totalEligibleOwnership,
      submitted_ownership: submittedOwnership,
      source_conflicts: conflicts.length,
      resolved_source_conflicts: conflicts.filter((conflict) => conflict.resolution)
        .length,
    },
    vote_source_audit: {
      online_room_ids: [...onlineRoomIds],
      manual_room_ids: [...manualRoomIds],
      effective_sources: [...effectiveRoomSources].map(([roomId, source]) => ({
        room_id: roomId,
        source,
      })),
      conflicts: conflicts.map((conflict) => ({
        room_id: conflict.room_id,
        online_ballot_id: conflict.online_ballot_id,
        manual_ballot_id: conflict.manual_ballot_id,
        chosen_source: conflict.resolution?.chosen_source ?? null,
        chosen_ballot_id: conflict.resolution?.chosen_ballot_id ?? null,
        conflict_remark: conflict.resolution?.conflict_remark ?? null,
        resolved_at: conflict.resolution?.resolved_at ?? null,
      })),
    },
    questions: questionsResult.data.map((question) => ({
      id: question.id,
      agenda_no: question.agenda_no,
      agenda_title: question.agenda_title,
      text: question.question_text,
      type: question.question_type,
      resolution_type: question.resolution_type,
      required_threshold: question.required_threshold,
      requires_land_office_registration:
        question.requires_land_office_registration,
      legal_note: question.legal_note,
      choices: question.meeting_choices
        .sort((left, right) => left.display_order - right.display_order)
        .map((choice) => {
          const count = countsByChoice.get(choice.id) ?? {
            voteCount: 0,
            ownership: 0,
          };

          return {
            id: choice.id,
            text: choice.choice_text,
            vote_count: count.voteCount,
            ownership: count.ownership,
            percent_of_total_ownership:
              totalEligibleOwnership > 0
                ? (count.ownership / totalEligibleOwnership) * 100
                : 0,
            percent_of_submitted_ownership:
              submittedOwnership > 0
                ? (count.ownership / submittedOwnership) * 100
                : 0,
          };
        }),
    })),
  };

  const { error: insertError } = await supabase.from("result_snapshots").insert({
    meeting_id: meetingId,
    generated_by: generator.id,
    payload_json: payload,
  });

  if (insertError) {
    throw insertError;
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "closed" })
    .eq("id", meetingId)
    .neq("status", "archived");

  if (meetingError) {
    throw meetingError;
  }

  revalidateAdminPaths();
}

export async function approveResultSnapshot(formData: FormData) {
  const approver = await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting ID");
  const resultSnapshotId = requiredText(
    formData.get("result_snapshot_id"),
    "Result snapshot ID",
  );
  const supabase = await createClient();
  const [snapshotResult, existingApprovalResult] = await Promise.all([
    supabase
      .from("result_snapshots")
      .select("id")
      .eq("id", resultSnapshotId)
      .eq("meeting_id", meetingId)
      .single(),
    supabase
      .from("committee_approvals")
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle(),
  ]);

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  if (existingApprovalResult.error) {
    throw existingApprovalResult.error;
  }

  if (existingApprovalResult.data) {
    throw new Error("This meeting already has an approved result.");
  }

  const { error } = await supabase.from("committee_approvals").insert({
    meeting_id: meetingId,
    result_snapshot_id: resultSnapshotId,
    approved_by: approver.id,
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    throw error;
  }

  await queueResultApprovedEmails(meetingId);

  revalidateAdminPaths();
}
