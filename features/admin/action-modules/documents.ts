"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { isSystemAdmin, requireProfile, requireSystemAdmin } from "@/lib/auth/permissions";

export type DocumentActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

export type AppSettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

const appSettingsFields = [
  "id",
  "document_storage_provider",
  "document_storage_root",
];

function appSettingsFormValues(formData: FormData) {
  return Object.fromEntries(
    appSettingsFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

function validateAppSettings(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!["local_drive", "google_drive"].includes(values.document_storage_provider)) {
    fieldErrors.document_storage_provider =
      "Document storage provider is required.";
  }

  return fieldErrors;
}

function appSettingsValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): AppSettingsActionState | null {
  const count = Object.keys(fieldErrors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors,
    values,
  };
}

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

const documentFormFields = [
  "storage_provider",
  "owner_type",
  "document_type",
  "owner_id",
  "storage_path",
  "document_set_key",
  "document_version",
  "original_filename",
  "mime_type",
  "file_size_bytes",
  "checksum_sha256",
];

const DOCUMENT_OWNER_TYPES = ["profile", "approval_request", "proxy_authorization", "meeting", "result_snapshot"];

function documentFormValues(formData: FormData) {
  const values: Record<string, string> = Object.fromEntries(
    documentFormFields.map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );

  // One picker per "Document of" kind (owner_id_profile, ...); the chosen
  // kind's picker gives the id (documents review 2026-11-19).
  for (const type of DOCUMENT_OWNER_TYPES) {
    values[`owner_id_${type}`] = String(formData.get(`owner_id_${type}`) ?? "");
  }

  if (!values.owner_id && DOCUMENT_OWNER_TYPES.includes(values.owner_type)) {
    values.owner_id = values[`owner_id_${values.owner_type}`];
  }

  return values;
}

function validateDocumentForm(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};
  // Form order: document type, whose document (a picker per kind), storage, path.
  const ownerField = DOCUMENT_OWNER_TYPES.includes(values.owner_type)
    ? `owner_id_${values.owner_type}`
    : "owner_type";

  if (!values.document_type.trim()) {
    fieldErrors.document_type = "Document type is required.";
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.owner_id.trim())) {
    fieldErrors[ownerField] = "Choose whose document it is.";
  }

  if (!values.storage_provider.trim()) {
    fieldErrors.storage_provider = "Storage provider is required.";
  }

  if (!values.storage_path.trim()) {
    fieldErrors.storage_path = "Path or link is required.";
  }

  // Empty version: the next one of the set (worked out when saving).
  if (values.document_version.trim()) {
    const version = Number(values.document_version);

    if (!Number.isInteger(version) || version <= 0) {
      fieldErrors.document_version = "Version must be a whole number greater than 0.";
    }
  }

  if (values.file_size_bytes) {
    const fileSize = Number(values.file_size_bytes);

    if (!Number.isInteger(fileSize) || fileSize < 0) {
      fieldErrors.file_size_bytes =
        "File size must be a whole number of 0 or greater.";
    }
  }

  if (
    values.checksum_sha256 &&
    !/^[0-9a-f]{64}$/i.test(values.checksum_sha256)
  ) {
    fieldErrors.checksum_sha256 =
      "SHA-256 checksum must contain exactly 64 hexadecimal characters.";
  }

  return fieldErrors;
}

function documentValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): DocumentActionState | null {
  const count = Object.keys(fieldErrors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors,
    values,
  };
}

export async function registerDocumentReferenceWithState(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const values = documentFormValues(formData);

  try {
    const admin = await requireAdmin();
    const validation = documentValidationState(
      validateDocumentForm(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    // Versions of one person's (meeting's, ...) document of one type share
    // a set unless the form names one; the list shows the owner, not the key.
    const setKey =
      values.document_set_key.trim() ||
      `${values.owner_type.trim()}:${values.owner_id.trim()}:${values.document_type.trim()}`;
    let documentVersion = Number(values.document_version);

    if (!values.document_version.trim()) {
      const { data: latest, error: latestError } = await supabase
        .from("documents")
        .select("document_version")
        .eq("document_set_key", setKey)
        .order("document_version", { ascending: false })
        .limit(1);

      if (latestError) {
        return { error: latestError.message, values };
      }

      documentVersion = (latest?.[0]?.document_version ?? 0) + 1;
    }

    const documentValues = {
      owner_type: values.owner_type.trim(),
      owner_id: values.owner_id.trim(),
      document_type: values.document_type.trim(),
      storage_provider: values.storage_provider.trim(),
      storage_path: values.storage_path.trim(),
      document_set_key: setKey,
      document_version: documentVersion,
      original_filename: optionalText(values.original_filename),
      mime_type: optionalText(values.mime_type),
      file_size_bytes: values.file_size_bytes
        ? Number(values.file_size_bytes)
        : null,
      checksum_sha256: values.checksum_sha256.toLowerCase() || null,
      visibility: "private",
      uploaded_by: admin.id,
    };
    const { data: document, error } = await supabase
      .from("documents")
      .insert(documentValues)
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    await writeAuditLog(supabase, {
      action: "document.registered",
      actorProfileId: admin.id,
      details: {
        document_set_key: documentValues.document_set_key,
        document_type: documentValues.document_type,
        document_version: documentValues.document_version,
        storage_provider: documentValues.storage_provider,
      },
      entityId: document.id,
      entityType: "document",
    });
    revalidateAdminPaths();

    return {
      recordId: document.id,
      success: "Document registered",
      values: { ...values, document_set_key: setKey },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not register document.",
      values,
    };
  }
}

export async function saveAppSettings(formData: FormData) {
  const admin = await requireSystemAdmin();
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

export async function saveAppSettingsWithState(
  _state: AppSettingsActionState,
  formData: FormData,
): Promise<AppSettingsActionState> {
  const values = appSettingsFormValues(formData);

  try {
    if (!(await isSystemAdmin())) {
      return {
        error: "Only a system admin can change technical settings.",
        values,
      };
    }

    const admin = await requireProfile();
    const validation = appSettingsValidationState(
      validateAppSettings(values),
      values,
    );

    if (validation) {
      return validation;
    }

    const id = optionalText(values.id);
    const documentStorageProvider = values.document_storage_provider;
    const payload = {
      document_storage_provider: documentStorageProvider,
      document_storage_root: optionalText(values.document_storage_root),
    };
    const supabase = await createClient();
    const { data: settings, error } = id
      ? await supabase
          .from("app_settings")
          .update(payload)
          .eq("id", id)
          .select("id")
          .single()
      : await supabase.from("app_settings").insert(payload).select("id").single();

    if (error) {
      return { error: error.message, values };
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
    revalidatePath("/system");

    return {
      recordId: settings.id,
      success: "Document storage config saved",
      values: {
        ...values,
        id: settings.id,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save document storage config.",
      values,
    };
  }
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
  redirect(
    `/admin/documents?set=${encodeURIComponent(values.document_set_key)}&feedback=success&message=${encodeURIComponent("Document registered")}`,
  );
}
