import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export { createClient, requireAdmin };

export function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

export function optionalNumber(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  return text ? Number(text) : null;
}

export function requiredIntegerInRange(
  value: FormDataEntryValue | null,
  fieldName: string,
  min: number,
  max: number,
) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }

  return number;
}

export function requiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

export function parseBooleanText(value: string | null, defaultValue = true) {
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

export function hasImportData(
  row: string[],
  value: (row: string[], header: string) => string | null,
  headers: string[],
) {
  return headers.some((header) => header !== "import_action" && value(row, header));
}

export function assertUpsertAction(
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

export function requiredDateTime(value: FormDataEntryValue | null, fieldName: string) {
  const text = requiredText(value, fieldName);
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date and time.`);
  }

  return date.toISOString();
}

export function optionalDate(value: FormDataEntryValue | null) {
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

export function optionalBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

export function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function revalidateAdminPaths() {
  revalidatePath("/admin", "layout");
}

export function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function getRelatedProfileEmail(
  profile:
    | { email?: string | null }
    | { email?: string | null }[]
    | null
    | undefined,
) {
  const item = Array.isArray(profile) ? profile[0] : profile;
  return item?.email?.trim().toLowerCase() || null;
}

export type EmailInviteState = {
  error?: string;
  message?: string;
};

export async function insertEmailLogs(
  rows: {
    recipient_email: string;
    template_key: string;
    status: string;
    error_message?: string | null;
  }[],
) {
  if (rows.length === 0) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("email_logs").insert(rows);

  if (error) {
    throw error;
  }
}



export async function readExcelSheetUpload(formData: FormData, sheetName: string) {
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

export async function queueResultApprovedEmails(meetingId: string) {
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
