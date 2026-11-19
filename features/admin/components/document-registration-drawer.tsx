"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { fill } from "@/lib/i18n/template";
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
import { SearchSelect, invalidFieldElement } from "@/features/ui/search-select";
import {
  DOCUMENT_OWNER_TYPES,
  documentOwnerSummary,
  documentTypeLabel,
} from "@/features/admin/components/sections/documents/document-labels";
import { FileCheckFields } from "@/features/admin/components/sections/documents/file-check-fields";
import type { DocumentRegistryRow } from "@/features/admin/components/sections/documents/document-rows";
import type { DocumentOwnerChoices } from "@/features/admin/data-modules/document-pickers";

// Register a document record (documents review 2026-11-19), in three groups:
// whose document (picked by name, room or email, submitting the id), where
// the file is, and check data (folded; filled from a local file).

type DocumentRegistrationDrawerProps = {
  closeHref: string;
  documentTypes: readonly string[];
  ownerChoices: DocumentOwnerChoices;
  /** "Register new version": the document it follows. */
  source?: DocumentRegistryRow | null;
};

const emptyState: DocumentActionState = {};
const groupClass = "grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-4";
const legendClass = "px-1 text-sm font-semibold";
const fieldClass = "grid min-w-0 gap-1 text-sm font-medium";
const inputClass = "min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";

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

function FieldError({ fieldName, state }: { fieldName: string; state: DocumentActionState }) {
  const tm = useMessageText();
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {tm(message)}
    </p>
  ) : null;
}

function stateValue(state: DocumentActionState, fieldName: string, fallback = "") {
  return state.values?.[fieldName] ?? fallback;
}

export function DocumentRegistrationDrawer({
  closeHref,
  documentTypes,
  ownerChoices,
  source,
}: DocumentRegistrationDrawerProps) {
  const tm = useMessageText();
  const { locale, s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(registerDocumentReferenceWithState, emptyState);
  const searchText = {
    clear: s.common.searchClear,
    more: s.common.searchMore,
    noResults: s.common.searchNoResults,
    placeholder: s.documents.ownerPlaceholder,
  };
  const ownerType = stateValue(state, "owner_type", source?.owner_type ?? "profile");
  // Selects remount with each answer: React resets the form after an action,
  // and a fresh select keeps the value just sent.
  const answerKey = JSON.stringify(state.values ?? null);

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const element = invalidFieldElement(formRef.current, firstInvalidField);

      if (element?.closest("details") instanceof HTMLDetailsElement) {
        (element.closest("details") as HTMLDetailsElement).open = true;
      }

      element?.focus();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    for (const key of ["mode", "page", "type", "set", "from", "id"]) {
      params.delete(key);
    }

    params.set("feedback", "success");
    params.set("message", state.success);
    params.set("focusDocumentId", state.recordId);
    window.location.assign(`/admin/documents?${params.toString()}`);
  }, [searchParams, state]);

  const sourceOwner = source ? documentOwnerSummary(s, source.owner_type, source.owner) : null;

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={
        source && sourceOwner
          ? [fill(s.documents.newVersionOf, { owner: sourceOwner.name, version: source.document_version })]
          : [s.documents.newReference]
      }
      title={source ? s.documents.registerVersion : s.documents.register}
    >
      <form action={formAction} className="grid gap-4" noValidate ref={formRef}>
        <RequiredNote />
        {state.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">
            {tm(state.error)}
          </div>
        ) : null}
        {source ? <input name="document_set_key" type="hidden" value={source.document_set_key} /> : null}

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.documents.groupOwner}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.documents.documentType}</FieldLabel>
            <select
              {...fieldProps("document_type", state)}
              className={inputClass}
              defaultValue={stateValue(state, "document_type", source?.document_type ?? documentTypes[0] ?? "other")}
              key={answerKey}
              name="document_type"
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {documentTypeLabel(s, type)}
                </option>
              ))}
            </select>
            <FieldError fieldName="document_type" state={state} />
          </label>
          <label className={fieldClass}>
            <FieldLabel required>{s.documents.ownerType}</FieldLabel>
            <select
              {...fieldProps("owner_type", state)}
              className={inputClass}
              defaultValue={ownerType}
              key={answerKey}
              name="owner_type"
            >
              {DOCUMENT_OWNER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {s.documents.ownerTypes[type]}
                </option>
              ))}
            </select>
            <FieldError fieldName="owner_type" state={state} />
          </label>
          {/* One picker per kind; the one for the chosen kind shows (CSS in
              app/globals.css), so it follows the select through form resets. */}
          {DOCUMENT_OWNER_TYPES.map((type) => {
            const name = `owner_id_${type}`;
            const options = ownerChoices[type].map((option) =>
              type === "result_snapshot" && option.hint
                ? { ...option, hint: formatDateTimeIn(locale, option.hint) }
                : option,
            );

            return (
              <div className={`owner-pick ${fieldClass}`} data-owner-pick={type} key={type}>
                <FieldLabel required>{s.documents.ownerPick[type]}</FieldLabel>
                <SearchSelect
                  {...fieldProps(name, state)}
                  defaultValue={stateValue(state, name, source?.owner_type === type ? source.owner_id : "")}
                  name={name}
                  options={options}
                  text={searchText}
                />
                <FieldError fieldName={name} state={state} />
              </div>
            );
          })}
        </fieldset>

        <fieldset className={groupClass}>
          <legend className={legendClass}>{s.documents.groupWhere}</legend>
          <label className={fieldClass}>
            <FieldLabel required>{s.documents.provider}</FieldLabel>
            <select
              {...fieldProps("storage_provider", state)}
              className={inputClass}
              defaultValue={stateValue(state, "storage_provider", source?.storage_provider ?? "local_drive")}
              key={answerKey}
              name="storage_provider"
            >
              <option value="local_drive">{s.system.localDrive}</option>
              <option value="google_drive">{s.system.googleDrive}</option>
            </select>
            <FieldError fieldName="storage_provider" state={state} />
          </label>
          <div className={fieldClass}>
            <label htmlFor="document-storage-path">
              <FieldLabel required>{s.documents.path}</FieldLabel>
            </label>
            <input
              {...fieldProps("storage_path", state)}
              aria-describedby={[fieldProps("storage_path", state)["aria-describedby"], "document-path-help"].filter(Boolean).join(" ")}
              autoComplete="off"
              className={inputClass}
              defaultValue={stateValue(state, "storage_path")}
              id="document-storage-path"
              name="storage_path"
            />
            <span className="text-xs font-normal text-[var(--muted)]" id="document-path-help">
              {s.documents.pathHelp}
            </span>
            <FieldError fieldName="storage_path" state={state} />
          </div>
        </fieldset>

        <details
          className="rounded-lg border border-[var(--border)]"
          open={
            Boolean(
              state.fieldErrors?.checksum_sha256 ||
                state.fieldErrors?.file_size_bytes ||
                state.fieldErrors?.document_version,
            ) || undefined
          }
        >
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
            {s.documents.groupCheck}
          </summary>
          <div className="grid gap-3 border-t border-[var(--border)] p-4">
            <FileCheckFields
              defaults={{
                original_filename: stateValue(state, "original_filename"),
                mime_type: stateValue(state, "mime_type"),
                file_size_bytes: stateValue(state, "file_size_bytes"),
                checksum_sha256: stateValue(state, "checksum_sha256"),
              }}
              errors={{
                file_size_bytes: <FieldError fieldName="file_size_bytes" state={state} />,
                checksum_sha256: <FieldError fieldName="checksum_sha256" state={state} />,
              }}
              fieldProps={(name) => fieldProps(name, state)}
            />
            <div className={`${fieldClass} md:max-w-xs`}>
              <label htmlFor="document-version">{s.documents.version}</label>
              <input
                {...fieldProps("document_version", state)}
                aria-describedby={[fieldProps("document_version", state)["aria-describedby"], "document-version-help"].filter(Boolean).join(" ")}
                className={inputClass}
                defaultValue={stateValue(state, "document_version")}
                id="document-version"
                min={1}
                name="document_version"
                type="number"
              />
              <span className="text-xs font-normal text-[var(--muted)]" id="document-version-help">
                {s.documents.versionHelp}
              </span>
              <FieldError fieldName="document_version" state={state} />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <PendingSubmitButton
            className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel={s.documents.adding}
            type="submit"
          >
            {source ? s.documents.registerVersion : s.documents.register}
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            {s.common.cancel}
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}
