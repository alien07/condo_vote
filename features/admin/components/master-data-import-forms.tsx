"use client";

import { useActionState, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import {
  importOwnersExcelWithState,
  importRoomOwnersExcelWithState,
  importRoomsExcelWithState,
  type ExcelImportActionState,
} from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type ImportCardProps = {
  action: (
    state: ExcelImportActionState,
    formData: FormData,
  ) => Promise<ExcelImportActionState>;
  description: string;
  templateHref: string;
  templateLabel: string;
  title: string;
  uploadLabel: string;
};

const initialState: ExcelImportActionState = {};

function fieldErrorId(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-file-error`;
}

function ImportMessage({ state }: { state: ExcelImportActionState }) {
  if (state.error) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        role="alert"
      >
        {state.error}
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
        {state.success}
      </div>
    );
  }

  return null;
}

function ImportCard({
  action,
  description,
  templateHref,
  templateLabel,
  title,
  uploadLabel,
}: ImportCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState(action, initialState);
  const hasFileError = Boolean(state.fieldErrors?.file);
  const errorId = fieldErrorId(title);

  useEffect(() => {
    if (!hasFileError) {
      return;
    }

    fileInputRef.current?.focus();
    fileInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hasFileError, state]);

  return (
    <form
      action={formAction}
      className="rounded-md border border-[var(--border)] p-4"
      noValidate
      ref={formRef}
    >
      <div className="mb-3 flex items-center gap-2">
        <Upload className="text-[var(--primary)]" size={18} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mb-3 text-sm text-[var(--muted)]">{description}</p>
      <div className="mb-3">
        <RequiredNote />
      </div>
      <ImportMessage state={state} />
      <a
        className="my-3 inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
        href={templateHref}
      >
        {templateLabel}
      </a>
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>Excel file</FieldLabel>
        <input
          accept=".xlsx"
          aria-describedby={hasFileError ? errorId : undefined}
          aria-invalid={hasFileError ? "true" : undefined}
          className="block w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          name="file"
          ref={fileInputRef}
          required
          type="file"
        />
        {state.fieldErrors?.file ? (
          <p className="text-xs font-medium text-red-700" id={errorId}>
            {state.fieldErrors.file}
          </p>
        ) : null}
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <PendingSubmitButton
          className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel="Uploading..."
          type="submit"
        >
          {uploadLabel}
        </PendingSubmitButton>
        <FormResetButton label="Clear form" />
      </div>
    </form>
  );
}

export function MasterDataImportForms() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ImportCard
        action={importRoomsExcelWithState}
        description="Reads the `Rooms` sheet. Upsert key: `room_number`."
        templateHref="/templates/rooms-import-template.xlsx"
        templateLabel="Download rooms template"
        title="Import rooms"
        uploadLabel="Upload rooms Excel"
      />
      <ImportCard
        action={importOwnersExcelWithState}
        description="Reads the `Owners` sheet. Upsert key: `email`."
        templateHref="/templates/owners-import-template.xlsx"
        templateLabel="Download owners template"
        title="Import owners"
        uploadLabel="Upload owners Excel"
      />
      <ImportCard
        action={importRoomOwnersExcelWithState}
        description="Reads the `RoomOwners` sheet. Links `room_number` to `owner_email` with role `owner`."
        templateHref="/templates/room-owners-import-template.xlsx"
        templateLabel="Download room owners template"
        title="Import room owners"
        uploadLabel="Upload room owners Excel"
      />
    </div>
  );
}
