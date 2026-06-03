"use server";

import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";

function optionalInteger(value: FormDataEntryValue | null, fieldName: string) {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  const number = Number(text);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return number;
}

function requiredPositiveInteger(
  value: FormDataEntryValue | null,
  fieldName: string,
) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

function optionalChecksum(value: FormDataEntryValue | null) {
  const checksum = optionalText(value)?.toLowerCase() ?? null;

  if (checksum && !/^[0-9a-f]{64}$/.test(checksum)) {
    throw new Error("SHA-256 checksum must contain exactly 64 hexadecimal characters.");
  }

  return checksum;
}

export async function saveAppSettings(formData: FormData) {
  const admin = await requireAdmin();
  const id = optionalText(formData.get("id"));
  const documentStorageProvider = requiredText(
    formData.get("document_storage_provider"),
    "Document storage provider",
  );
  const values = {
    document_storage_provider: documentStorageProvider,
    document_storage_root: optionalText(formData.get("document_storage_root")),
  };
  const supabase = await createClient();
  const { data: settings, error } = id
    ? await supabase
        .from("app_settings")
        .update(values)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase.from("app_settings").insert(values).select("id").single();

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: id ? "app_settings.updated" : "app_settings.created",
    actorProfileId: admin.id,
    details: {
      document_storage_provider: documentStorageProvider,
    },
    entityId: settings.id,
    entityType: "app_settings",
  });
  revalidateAdminPaths();
}

export async function registerDocumentReference(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const values = {
    owner_type: requiredText(formData.get("owner_type"), "Owner type"),
    owner_id: requiredText(formData.get("owner_id"), "Owner ID"),
    document_type: requiredText(formData.get("document_type"), "Document type"),
    storage_provider: requiredText(
      formData.get("storage_provider"),
      "Storage provider",
    ),
    storage_path: requiredText(formData.get("storage_path"), "Path or link"),
    document_set_key: requiredText(
      formData.get("document_set_key"),
      "Document set key",
    ),
    document_version: requiredPositiveInteger(
      formData.get("document_version"),
      "Document version",
    ),
    original_filename: optionalText(formData.get("original_filename")),
    mime_type: optionalText(formData.get("mime_type")),
    file_size_bytes: optionalInteger(formData.get("file_size_bytes"), "File size"),
    checksum_sha256: optionalChecksum(formData.get("checksum_sha256")),
    visibility: "private",
    uploaded_by: admin.id,
  };
  const { data: document, error } = await supabase
    .from("documents")
    .insert(values)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await writeAuditLog(supabase, {
    action: "document.registered",
    actorProfileId: admin.id,
    details: {
      document_set_key: values.document_set_key,
      document_type: values.document_type,
      document_version: values.document_version,
      storage_provider: values.storage_provider,
    },
    entityId: document.id,
    entityType: "document",
  });
  revalidateAdminPaths();
}
