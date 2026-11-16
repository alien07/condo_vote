"use client";

import { useActionState } from "react";
import { setOwnerAccountWithState } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import {
  FieldError,
  FormErrorSummary,
  emptyState,
  fieldProps,
  stateValue,
} from "@/features/admin/components/sections/people/people-form-helpers";
import type { Owner, Profile } from "@/features/admin/components/sections/people/people-types";

/** Voting account of an owner of record, in the owner drawer (D024). */
export function OwnerAccountPanel({
  canManage,
  owner,
  profiles,
}: {
  canManage: boolean;
  owner: Owner;
  profiles: Profile[];
}) {
  const { s } = useStaffText();
  const tm = useMessageText();
  const [state, formAction] = useActionState(setOwnerAccountWithState, emptyState);
  const linked = owner.profile_id
    ? profiles.find((profile) => profile.id === owner.profile_id)
    : undefined;

  return (
    <section
      aria-labelledby="owner-account-title"
      className="mt-6 grid gap-3 border-t border-[var(--border)] pt-5"
    >
      <div>
        <h3 className="text-sm font-semibold" id="owner-account-title">
          {s.people.accountTitle}
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">{s.people.accountIntro}</p>
      </div>
      <p className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
        {linked
          ? fill(s.people.accountLinked, { name: linked.full_name, email: linked.email })
          : s.people.accountNotLinked}
      </p>
      {!linked ? (
        <p className="text-xs text-[var(--muted)]">{s.people.accountNotLinkedHelp}</p>
      ) : null}

      {canManage ? (
        <form action={formAction} className="grid gap-3" noValidate>
          <FormErrorSummary state={state} />
          {state.success ? (
            <p className="text-sm font-medium text-[var(--primary)]" role="status">
              {tm(state.success)}
            </p>
          ) : null}
          <input name="owner_id" type="hidden" value={owner.id} />
          <label className="grid gap-1 text-sm font-medium">
            {s.people.accountEmail}
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={stateValue(state, "profile_email")}
              name="profile_email"
              type="email"
              {...fieldProps("profile_email", state)}
            />
            <FieldError fieldName="profile_email" state={state} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {s.people.accountReason}
            <textarea
              className="min-h-20 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={stateValue(state, "reason")}
              maxLength={500}
              name="reason"
              {...fieldProps("reason", state)}
            />
            <FieldError fieldName="reason" state={state} />
          </label>
          <div className="flex flex-wrap gap-2">
            <ConfirmSubmitButton
              className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              confirmMessage={s.people.confirmAccountLink}
              name="intent"
              tone="primary"
              value="link"
            >
              {s.people.accountLink}
            </ConfirmSubmitButton>
            {linked ? (
              <ConfirmSubmitButton
                className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                confirmMessage={s.people.confirmAccountUnlink}
                name="intent"
                value="unlink"
              >
                {s.people.accountUnlink}
              </ConfirmSubmitButton>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="text-xs text-[var(--muted)]">{s.people.accountAdminOnly}</p>
      )}
    </section>
  );
}
