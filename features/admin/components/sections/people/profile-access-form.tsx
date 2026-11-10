"use client";

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
          <FieldLabel required>Default status</FieldLabel>
          <select
            autoFocus
            aria-required="true"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "default_status", profile.default_status)}
            name="default_status"
            {...fieldProps("default_status", state)}
          >
            <option value="owner">Owner</option>
            <option value="resident">Resident</option>
            <option value="proxy">Proxy</option>
          </select>
          <FieldError fieldName="default_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Approval status</FieldLabel>
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <FieldError fieldName="approval_status" state={state} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Language
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(
              state,
              "preferred_language",
              profile.preferred_language ?? "th",
            )}
            name="preferred_language"
          >
            <option value="th">Thai</option>
            <option value="en">English</option>
          </select>
          <span className="text-xs font-normal text-[var(--muted)]">
            Owner pages, emails and the owner summary use this language. The
            owner can also change it with the language switch.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Grant role
          <select
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "role")}
            name="role"
          >
            <option value="">No new role</option>
            <option value="admin">Admin</option>
            <option value="committee">Committee</option>
            <option value="system_admin">System admin</option>
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <DrawerSubmitButton pendingLabel="Saving...">
            Save changes
          </DrawerSubmitButton>
          <FormResetButton label="Reset changes" />
          <Link
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            Cancel
          </Link>
        </div>
      </form>

      <section className="rounded-md border border-[var(--border)] p-3">
        <h3 className="text-sm font-semibold">Current app roles</h3>
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
                  confirmMessage={`Revoke role "${role.role}" from ${profile.full_name}? This removes that app permission immediately.`}
                  pendingLabel="Revoking..."
                  type="submit"
                >
                  Revoke
                </ConfirmSubmitButton>
              </form>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No app roles assigned.</p>
          )}
        </div>
      </section>
    </div>
  );
}
