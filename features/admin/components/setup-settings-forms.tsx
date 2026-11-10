"use client";

import { useActionState, useEffect, useRef } from "react";
import { useStaffText } from "@/lib/i18n/staff/client";
import {
  saveAppSettingsWithState,
  saveCondoProfileWithState,
  type AppSettingsActionState,
  type CondoProfileActionState,
} from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

type CondoProfile = {
  address: string | null;
  document_footer: string | null;
  email: string | null;
  id: string;
  juristic_name: string;
  manager_name: string | null;
  phone: string | null;
  project_name: string;
  registration_no: string | null;
  summary_history_limit: number | null;
  tax_id: string | null;
  record_signatories?: string[];
  result_notice_days?: number | null;
} | null;

type AppSettings = {
  document_storage_provider: string;
  document_storage_root: string | null;
  id: string;
} | null;

const emptyCondoState: CondoProfileActionState = {};
const emptyAppSettingsState: AppSettingsActionState = {};

function fieldErrorId(prefix: string, fieldName: string) {
  return `${prefix}-${fieldName}-error`;
}

function fieldProps(
  prefix: string,
  fieldName: string,
  state: CondoProfileActionState | AppSettingsActionState,
) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(prefix, fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

function FieldError({
  fieldName,
  prefix,
  state,
}: {
  fieldName: string;
  prefix: string;
  state: CondoProfileActionState | AppSettingsActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(prefix, fieldName)}>
      {message}
    </p>
  ) : null;
}

function FormMessage({
  state,
}: {
  state: CondoProfileActionState | AppSettingsActionState;
}) {
  if (state.error) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 md:col-span-2"
        role="alert"
      >
        {state.error}
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 md:col-span-2">
        {state.success}
      </div>
    );
  }

  return null;
}

function stateValue(
  state: CondoProfileActionState | AppSettingsActionState,
  fieldName: string,
  fallback: string | number | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

function focusFirstInvalidField(
  form: HTMLFormElement | null,
  state: CondoProfileActionState | AppSettingsActionState,
) {
  const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

  if (!firstInvalidField) {
    return;
  }

  const field = form?.elements.namedItem(firstInvalidField);
  const element =
    field instanceof RadioNodeList
      ? field[0]
      : field instanceof HTMLElement
        ? field
        : null;

  element?.focus();
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function JuristicProfileForm({
  condoProfile,
}: {
  condoProfile: CondoProfile;
}) {
  const { s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveCondoProfileWithState,
    emptyCondoState,
  );

  useEffect(() => {
    focusFirstInvalidField(formRef.current, state);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2" noValidate ref={formRef}>
      <FormMessage state={state} />
      <div className="md:col-span-2">
        <RequiredNote />
      </div>
      <input name="id" type="hidden" value={stateValue(state, "id", condoProfile?.id)} />
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>{s.setup.juristicName}</FieldLabel>
        <input
          {...fieldProps("condo-profile", "juristic_name", state)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "juristic_name",
            condoProfile?.juristic_name,
          )}
          name="juristic_name"
          required
        />
        <FieldError fieldName="juristic_name" prefix="condo-profile" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>{s.setup.projectName}</FieldLabel>
        <input
          {...fieldProps("condo-profile", "project_name", state)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "project_name", condoProfile?.project_name)}
          name="project_name"
          required
        />
        <FieldError fieldName="project_name" prefix="condo-profile" state={state} />
      </label>
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "registration_no", condoProfile?.registration_no)}
        name="registration_no"
        placeholder={s.setup.registrationNo}
      />
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "tax_id", condoProfile?.tax_id)}
        name="tax_id"
        placeholder={s.setup.taxId}
      />
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "manager_name", condoProfile?.manager_name)}
        name="manager_name"
        placeholder={s.setup.manager}
      />
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "phone", condoProfile?.phone)}
        name="phone"
        placeholder={s.setup.phone}
      />
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "email", condoProfile?.email)}
        name="email"
        placeholder={s.setup.email}
        type="email"
      />
      <label className="grid gap-1 text-sm font-medium">
        {s.setup.historyLimit}
        <input
          {...fieldProps("condo-profile", "summary_history_limit", state)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "summary_history_limit",
            condoProfile?.summary_history_limit ?? 5,
          )}
          max={20}
          min={1}
          name="summary_history_limit"
          type="number"
        />
        <FieldError
          fieldName="summary_history_limit"
          prefix="condo-profile"
          state={state}
        />
      </label>
      <input
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        defaultValue={stateValue(state, "address", condoProfile?.address)}
        name="address"
        placeholder={s.setup.address}
      />
      <fieldset className="grid gap-2 rounded-md border border-[var(--border)] p-3 text-sm md:col-span-2">
        <legend className="px-1 font-medium">{s.setup.recordTitle}</legend>
        <span className="text-xs text-[var(--muted)]">
          {s.setup.recordHelp}
        </span>
        <span className="font-medium">{s.setup.signedBy}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {[
            ["chairperson", s.setup.chairperson],
            ["manager", s.setup.managerRole],
            ["minutes_taker", s.setup.minutesTaker],
            ["committee_member", s.setup.committeeMember],
          ].map(([value, label]) => (
            <label className="inline-flex min-h-11 items-center gap-2" key={value}>
              <input
                className="h-4 w-4 accent-[var(--primary)]"
                defaultChecked={(
                  state.values?.record_signatories?.split(",") ??
                  condoProfile?.record_signatories ?? ["chairperson", "manager"]
                ).includes(value)}
                name="record_signatories"
                type="checkbox"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError fieldName="record_signatories" prefix="condo-profile" state={state} />
        <label className="grid gap-1 font-medium md:max-w-xs">
          {s.setup.noticeDays}
          <input
            {...fieldProps("condo-profile", "result_notice_days", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
            defaultValue={stateValue(
              state,
              "result_notice_days",
              condoProfile?.result_notice_days ?? "",
            )}
            max={90}
            min={1}
            name="result_notice_days"
            type="number"
          />
          <FieldError fieldName="result_notice_days" prefix="condo-profile" state={state} />
        </label>
      </fieldset>
      <textarea
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
        defaultValue={stateValue(
          state,
          "document_footer",
          condoProfile?.document_footer,
        )}
        name="document_footer"
        placeholder={s.setup.footer}
        rows={2}
      />
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <PendingSubmitButton
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel={s.common.saving}
          type="submit"
        >
          {s.setup.saveJuristic}
        </PendingSubmitButton>
        <FormResetButton label="Reset changes" />
      </div>
    </form>
  );
}

export function DocumentStorageSettingsForm({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveAppSettingsWithState,
    emptyAppSettingsState,
  );
  const { s: staff } = useStaffText();
  const t = staff.system;

  useEffect(() => {
    focusFirstInvalidField(formRef.current, state);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2" noValidate ref={formRef}>
      <FormMessage state={state} />
      <input name="id" type="hidden" value={stateValue(state, "id", appSettings?.id)} />
      <label className="grid gap-1 text-sm font-medium">
        {t.storageProvider}
        <select
          {...fieldProps("app-settings", "document_storage_provider", state)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "document_storage_provider",
            appSettings?.document_storage_provider ?? "local_drive",
          )}
          name="document_storage_provider"
        >
          <option value="local_drive">{t.localDrive}</option>
          <option value="google_drive">{t.googleDrive}</option>
        </select>
        <FieldError
          fieldName="document_storage_provider"
          prefix="app-settings"
          state={state}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t.storageRoot}
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(
            state,
            "document_storage_root",
            appSettings?.document_storage_root,
          )}
          name="document_storage_root"
          placeholder={t.storageRootPlaceholder}
        />
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <PendingSubmitButton
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel={staff.common.saving}
          type="submit"
        >
          {t.saveStorage}
        </PendingSubmitButton>
        <FormResetButton label="Reset changes" />
      </div>
    </form>
  );
}
