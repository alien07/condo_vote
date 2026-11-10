"use client";

import { useActionState } from "react";
import {
  savePrivacySettingsWithState,
  type PrivacySettingsActionState,
} from "@/features/privacy/actions";
import type { PrivacySettings } from "@/features/privacy/service";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";

const emptyState: PrivacySettingsActionState = {};

function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: PrivacySettingsActionState;
}) {
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <span className="text-xs font-medium text-red-700" id={`privacy-${fieldName}-error`}>
      {message}
    </span>
  ) : null;
}

export function PrivacySettingsForm({ settings }: { settings: PrivacySettings }) {
  const [state, formAction] = useActionState(savePrivacySettingsWithState, emptyState);
  const value = (field: keyof PrivacySettings) =>
    state.values?.[field] ?? String(settings[field] ?? "");

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state.error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
          role="status"
        >
          {state.success}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          defaultChecked={
            state.values ? state.values.consent_required === "on" : settings.consent_required
          }
          name="consent_required"
          type="checkbox"
        />
        Ask every user to accept the privacy notice before using the app
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Privacy notice in Thai (version {settings.notice_version})
        <textarea
          aria-describedby="privacy-notice_text-error"
          aria-invalid={Boolean(state.fieldErrors?.notice_text)}
          className="min-h-56 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal leading-6"
          defaultValue={value("notice_text")}
          name="notice_text"
        />
        <span className="text-xs font-normal text-[var(--muted)]">
          Changing the text starts a new version. Everyone accepts it again at
          their next visit.
        </span>
        <FieldError fieldName="notice_text" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Privacy notice in English (optional)
        <textarea
          className="min-h-56 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal leading-6"
          defaultValue={value("notice_text_en")}
          lang="en"
          name="notice_text_en"
        />
        <span className="text-xs font-normal text-[var(--muted)]">
          Shown to owners who chose English. Leave empty to show the Thai notice.
        </span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Keep vote records (months)
          <input
            aria-invalid={Boolean(state.fieldErrors?.retention_months_vote_records)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={value("retention_months_vote_records")}
            max={600}
            min={12}
            name="retention_months_vote_records"
            type="number"
          />
          <FieldError fieldName="retention_months_vote_records" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Keep inactive profiles (months)
          <input
            aria-invalid={Boolean(state.fieldErrors?.retention_months_inactive_profiles)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={value("retention_months_inactive_profiles")}
            max={600}
            min={1}
            name="retention_months_inactive_profiles"
            type="number"
          />
          <FieldError fieldName="retention_months_inactive_profiles" state={state} />
        </label>
      </div>
      <div>
        <PendingSubmitButton
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel="Saving..."
          type="submit"
        >
          Save privacy settings
        </PendingSubmitButton>
      </div>
    </form>
  );
}
