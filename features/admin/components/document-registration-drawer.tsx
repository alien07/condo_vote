"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  registerDocumentReferenceWithState,
  type DocumentActionState,
} from "@/features/admin/action-modules/documents";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type DocumentRegistrationDrawerProps = {
  closeHref: string;
  documentTypes: string[];
};

const emptyState: DocumentActionState = {};

function fieldErrorId(fieldName: string) {
  return `document-${fieldName}-error`;
}

function fieldProps(fieldName: string, state: DocumentActionState) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: DocumentActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {message}
    </p>
  ) : null;
}

function stateValue(
  state: DocumentActionState,
  fieldName: string,
  fallback = "",
) {
  return state.values?.[fieldName] ?? fallback;
}

export function DocumentRegistrationDrawer({
  closeHref,
  documentTypes,
}: DocumentRegistrationDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    registerDocumentReferenceWithState,
    emptyState,
  );

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const field = formRef.current?.elements.namedItem(firstInvalidField);
      const element =
        field instanceof RadioNodeList
          ? field[0]
          : field instanceof HTMLElement
            ? field
            : null;

      element?.focus();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.delete("mode");
    params.delete("page");
    params.delete("type");
    params.set("set", state.values?.document_set_key ?? "");
    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusDocumentId", state.recordId);
    window.location.assign(`/admin/documents?${params.toString()}`);
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={["New private document reference"]}
      title="Register document"
    >
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        {state.error ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="alert"
          >
            {state.error}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Storage provider</FieldLabel>
          <select
            {...fieldProps("storage_provider", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "storage_provider", "local_drive")}
            name="storage_provider"
          >
            <option value="local_drive">Local drive</option>
            <option value="google_drive">Google Drive</option>
          </select>
          <FieldError fieldName="storage_provider" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Owner type</FieldLabel>
          <select
            {...fieldProps("owner_type", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "owner_type", "profile")}
            name="owner_type"
          >
            <option value="profile">Profile</option>
            <option value="approval_request">Approval request</option>
            <option value="proxy_authorization">Proxy authorization</option>
            <option value="meeting">Meeting</option>
            <option value="result_snapshot">Result snapshot</option>
          </select>
          <FieldError fieldName="owner_type" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Document type</FieldLabel>
          <select
            {...fieldProps("document_type", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "document_type",
              documentTypes[0] ?? "other",
            )}
            name="document_type"
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <FieldError fieldName="document_type" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Owner UUID</FieldLabel>
          <input
            {...fieldProps("owner_id", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "owner_id")}
            name="owner_id"
          />
          <FieldError fieldName="owner_id" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>
            Relative path or private Drive file link
          </FieldLabel>
          <input
            {...fieldProps("storage_path", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "storage_path")}
            name="storage_path"
          />
          <FieldError fieldName="storage_path" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Document set key</FieldLabel>
          <input
            {...fieldProps("document_set_key", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "document_set_key")}
            name="document_set_key"
            placeholder="proxy-meeting-room"
          />
          <FieldError fieldName="document_set_key" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Version</FieldLabel>
          <input
            {...fieldProps("document_version", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "document_version", "1")}
            min={1}
            name="document_version"
            type="number"
          />
          <FieldError fieldName="document_version" state={state} />
        </label>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "original_filename")}
          name="original_filename"
          placeholder="Original filename"
        />
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "mime_type")}
          name="mime_type"
          placeholder="MIME type"
        />
        <label className="grid gap-1 text-sm font-medium">
          File size bytes
          <input
            {...fieldProps("file_size_bytes", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "file_size_bytes")}
            min={0}
            name="file_size_bytes"
            type="number"
          />
          <FieldError fieldName="file_size_bytes" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          SHA-256 checksum
          <input
            {...fieldProps("checksum_sha256", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "checksum_sha256")}
            name="checksum_sha256"
            placeholder="64 hex characters"
          />
          <FieldError fieldName="checksum_sha256" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel="Adding..."
            type="submit"
          >
            Register document
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            Cancel
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}
