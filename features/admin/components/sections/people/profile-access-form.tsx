"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useActionState, useRef } from "react";
import { revokeAppRole, updateProfileAccessWithState } from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { ConfirmSubmitButton, FormResetButton } from "@/features/admin/components/form-controls";
import Link from "next/link";
import {
  DrawerSubmitButton,
  FieldError,
  FormErrorSummary,
  emptyState,
  fieldProps,
  stateValue,
  usePeopleFormFeedback,
} from "@/features/admin/components/sections/people/people-form-helpers";
import type { AppRole, Profile } from "@/features/admin/components/sections/people/people-types";

export function ProfileAccessForm({
  appRoles,
  closeHref,
  profile,
}: {
  appRoles: AppRole[];
  closeHref: string;
  profile: Profile;
}) {
  const { s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    updateProfileAccessWithState,
    emptyState,
  );
  usePeopleFormFeedback("profiles", state, formRef);

  return (
    <div className="grid gap-5">
      <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
        <RequiredNote />
        <FormErrorSummary state={state} />
        <input name="id" type="hidden" value={profile.id} />
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.people.defaultStatus}</FieldLabel>
          <select
            autoFocus
            aria-required="true"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "default_status", profile.default_status)}
            name="default_status"
            {...fieldProps("default_status", state)}
          >
            <option value="owner">{s.people.ownerOption}</option>
            <option value="resident">{s.people.residentOption}</option>
            <option value="proxy">{s.people.proxyOption}</option>
          </select>
          <FieldError fieldName="default_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.people.approvalStatus}</FieldLabel>
          <select
            aria-required="true"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "approval_status",
              profile.approval_status,
            )}
            name="approval_status"
            {...fieldProps("approval_status", state)}
          >
            <option value="pending">{s.people.pendingOption}</option>
            <option value="approved">{s.people.approvedOption}</option>
            <option value="rejected">{s.people.rejectedOption}</option>
          </select>
          <FieldError fieldName="approval_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {s.people.language}
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "preferred_language",
              profile.preferred_language ?? "th",
            )}
            name="preferred_language"
          >
            <option value="th">{s.people.thai}</option>
            <option value="en">{s.people.english}</option>
          </select>
          <span className="text-xs font-normal text-[var(--muted)]">
            {s.people.languageHelp}
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {s.people.grantRole}
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "role")}
            name="role"
          >
            <option value="">{s.people.noNewRole}</option>
            <option value="admin">{s.people.adminRole}</option>
            <option value="committee">{s.people.committeeRole}</option>
            <option value="system_admin">{s.people.systemAdminRole}</option>
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <DrawerSubmitButton pendingLabel={s.common.saving}>
            {s.people.saveChanges}
          </DrawerSubmitButton>
          <FormResetButton label="Reset changes" />
          <Link
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            {s.common.cancel}
          </Link>
        </div>
      </form>

      <section className="rounded-md border border-[var(--border)] p-3">
        <h3 className="text-sm font-semibold">{s.people.currentRoles}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {appRoles.length ? (
            appRoles.map((role) => (
              <form
                action={revokeAppRole}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                key={role.id}
              >
                <span>{role.role}</span>
                <input name="id" type="hidden" value={role.id} />
                <ConfirmSubmitButton
                  className="text-xs font-medium text-red-700"
                  confirmMessage={fill(s.people.confirmRevoke, { role: role.role, name: profile.full_name })}
                  pendingLabel={s.people.revoking}
                  type="submit"
                >
                  {s.people.revoke}
                </ConfirmSubmitButton>
              </form>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">{s.people.noRoles}</p>
          )}
        </div>
      </section>
    </div>
  );
}
