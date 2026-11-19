"use client";

import { useActionState, useEffect, useRef } from "react";
import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
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
  project_name_en?: string | null;
  juristic_name_en?: string | null;
  bilingual_documents?: boolean;
} | null;

type AppSettings = {
  document_storage_provider: string;
  document_storage_root: string | null;
  id: string;
} | null;

const emptyCondoState: CondoProfileActionState = {};

// Same groups and controls as the meeting form; checkboxes are 44px tap
// targets with the label around the box (setup review 2026-11-19).
const groupClass = "grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-4 md:grid-cols-2";
const legendClass = "px-1 text-sm font-semibold";
const fieldClass = "grid min-w-0 gap-1 text-sm font-medium";
const inputClass =
  "min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";
const choice =
  "inline-flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm font-medium has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]";
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
  const tm = useMessageText();
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(prefix, fieldName)}>
      {tm(message)}
    </p>
  ) : null;
}

function FormMessage({
  state,
}: {
  state: CondoProfileActionState | AppSettingsActionState;
}) {
  const tm = useMessageText();
  if (state.error) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 md:col-span-2"
        role="alert"
      >
        {tm(state.error)}
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 md:col-span-2">
        {tm(state.success)}
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

  const text = (fieldName: string, fallback: string | number | null | undefined) =>
    stateValue(state, fieldName, fallback);

  return (
    <form action={formAction} className="grid gap-4" noValidate ref={formRef}>
      <FormMessage state={state} />
      <RequiredNote />
      <input name="id" type="hidden" value={stateValue(state, "id", condoProfile?.id)} />
      {/* Every field has a visible label, grouped like the meeting form (setup review 2026-11-19). */}
      <fieldset className={groupClass}>
        <legend className={legendClass}>{s.setup.groupRegistration}</legend>
        <label className={fieldClass}>
          <FieldLabel required>{s.setup.juristicName}</FieldLabel>
          <input
            {...fieldProps("condo-profile", "juristic_name", state)}
            autoComplete="organization"
            className={inputClass}
            defaultValue={text("juristic_name", condoProfile?.juristic_name)}
            name="juristic_name"
            required
          />
          <FieldError fieldName="juristic_name" prefix="condo-profile" state={state} />
        </label>
        <label className={fieldClass}>
          <FieldLabel required>{s.setup.projectName}</FieldLabel>
          <input
            {...fieldProps("condo-profile", "project_name", state)}
            autoComplete="off"
            className={inputClass}
            defaultValue={text("project_name", condoProfile?.project_name)}
            name="project_name"
            required
          />
          <FieldError fieldName="project_name" prefix="condo-profile" state={state} />
        </label>
        {/* Two-language documents (demo feedback item 6b). */}
        <label className={fieldClass}>
          {s.english.juristicNameEn}
          <input
            autoComplete="off"
            className={inputClass}
            defaultValue={text("juristic_name_en", condoProfile?.juristic_name_en ?? "")}
            lang="en"
            name="juristic_name_en"
          />
        </label>
        <label className={fieldClass}>
          {s.english.projectNameEn}
          <input
            autoComplete="off"
            className={inputClass}
            defaultValue={text("project_name_en", condoProfile?.project_name_en ?? "")}
            lang="en"
            name="project_name_en"
          />
        </label>
        <label className={fieldClass}>
          {s.setup.registrationNo}
          <input
            autoComplete="off"
            className={inputClass}
            defaultValue={text("registration_no", condoProfile?.registration_no)}
            name="registration_no"
          />
        </label>
        <label className={fieldClass}>
          {s.setup.taxId}
          <input
            autoComplete="off"
            className={inputClass}
            defaultValue={text("tax_id", condoProfile?.tax_id)}
            inputMode="numeric"
            name="tax_id"
          />
        </label>
      </fieldset>
      <fieldset className={groupClass}>
        <legend className={legendClass}>{s.setup.groupContact}</legend>
        <label className={fieldClass}>
          {s.setup.manager}
          <input
            autoComplete="name"
            className={inputClass}
            defaultValue={text("manager_name", condoProfile?.manager_name)}
            name="manager_name"
          />
        </label>
        <label className={fieldClass}>
          {s.setup.phone}
          <input
            autoComplete="tel"
            className={inputClass}
            defaultValue={text("phone", condoProfile?.phone)}
            name="phone"
            type="tel"
          />
        </label>
        <label className={fieldClass}>
          {s.setup.email}
          <input
            autoComplete="email"
            className={inputClass}
            defaultValue={text("email", condoProfile?.email)}
            name="email"
            type="email"
          />
        </label>
        <label className={`${fieldClass} md:col-span-2`}>
          {s.setup.address}
          <textarea
            autoComplete="street-address"
            className={inputClass}
            defaultValue={text("address", condoProfile?.address)}
            name="address"
            rows={2}
          />
        </label>
      </fieldset>
      <fieldset className={groupClass}>
        <legend className={legendClass}>{s.setup.groupDocuments}</legend>
        <label className={`${choice} md:col-span-2`}>
          <input
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
            defaultChecked={
              state?.values ? state.values.bilingual_documents === "on" : Boolean(condoProfile?.bilingual_documents)
            }
            name="bilingual_documents"
            type="checkbox"
          />
          <span>
            {s.english.bilingualSwitch}
            <span className="block font-normal text-[var(--muted)]">{s.english.bilingualHelp}</span>
          </span>
        </label>
        <label className={fieldClass}>
          {s.setup.historyLimit}
          <input
            {...fieldProps("condo-profile", "summary_history_limit", state)}
            className={inputClass}
            defaultValue={text("summary_history_limit", condoProfile?.summary_history_limit ?? 5)}
            max={20}
            min={1}
            name="summary_history_limit"
            type="number"
          />
          <FieldError fieldName="summary_history_limit" prefix="condo-profile" state={state} />
        </label>
        <fieldset className="grid min-w-0 gap-2 rounded-md border border-[var(--border)] p-3 text-sm md:col-span-2">
          <legend className="px-1 font-medium">{s.setup.recordTitle}</legend>
          <span className="text-xs text-[var(--muted)]">{s.setup.recordHelp}</span>
          <fieldset className="grid gap-2">
            <legend className="font-medium">{s.setup.signedBy}</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ["chairperson", s.setup.chairperson],
                ["manager", s.setup.managerRole],
                ["minutes_taker", s.setup.minutesTaker],
                ["committee_member", s.setup.committeeMember],
              ].map(([value, label]) => (
                <label className={choice} key={value}>
                  <input
                    className="h-5 w-5 shrink-0 accent-[var(--primary)]"
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
          </fieldset>
          <FieldError fieldName="record_signatories" prefix="condo-profile" state={state} />
          <label className={`${fieldClass} md:max-w-xs`}>
            {s.setup.noticeDays}
            <input
              {...fieldProps("condo-profile", "result_notice_days", state)}
              className={inputClass}
              defaultValue={text("result_notice_days", condoProfile?.result_notice_days ?? "")}
              max={90}
              min={1}
              name="result_notice_days"
              type="number"
            />
            <FieldError fieldName="result_notice_days" prefix="condo-profile" state={state} />
          </label>
        </fieldset>
        <label className={`${fieldClass} md:col-span-2`}>
          {s.setup.footer}
          <textarea
            autoComplete="off"
            className={inputClass}
            defaultValue={text("document_footer", condoProfile?.document_footer)}
            name="document_footer"
            rows={2}
          />
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <PendingSubmitButton
          className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
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
      <label className={fieldClass}>
        {t.storageProvider}
        <select
          {...fieldProps("app-settings", "document_storage_provider", state)}
          className={inputClass}
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
      <label className={fieldClass}>
        {t.storageRoot}
        <input
          className={inputClass}
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
          className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
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
