"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { useActionState, useRef } from "react";
import { createOwnerWithState, updateOwnerWithState } from "@/features/admin/actions";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
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
import type { Owner } from "@/features/admin/components/sections/people/people-types";

export function OwnerForm({
  closeHref,
  mode,
  owner,
}: {
  closeHref: string;
  mode: "create" | "edit";
  owner?: Owner;
}) {
  const { s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    mode === "create" ? createOwnerWithState : updateOwnerWithState,
    emptyState,
  );
  usePeopleFormFeedback("owners", state, formRef);

  return (
    <form action={formAction} className="grid gap-3" noValidate ref={formRef}>
      <RequiredNote />
      <FormErrorSummary state={state} />
      {owner ? <input name="id" type="hidden" value={owner.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">
        <FieldLabel required>{s.people.fullName}</FieldLabel>
        <input
          autoFocus
          aria-required="true"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "full_name", owner?.full_name)}
          name="full_name"
          {...fieldProps("full_name", state)}
        />
        <FieldError fieldName="full_name" state={state} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {s.people.email}
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "email", owner?.email)}
          name="email"
          type="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {s.people.phone}
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "phone", owner?.phone)}
          name="phone"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {s.people.lineId}
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={stateValue(state, "line_id", owner?.line_id)}
          name="line_id"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <DrawerSubmitButton pendingLabel={mode === "create" ? s.people.adding : s.common.saving}>
          {mode === "create" ? s.people.createOwner : s.people.saveChanges}
        </DrawerSubmitButton>
        <FormResetButton label={mode === "create" ? "Clear form" : "Reset changes"} />
        <Link
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          href={closeHref}
        >
          {s.common.cancel}
        </Link>
      </div>
    </form>
  );
}
