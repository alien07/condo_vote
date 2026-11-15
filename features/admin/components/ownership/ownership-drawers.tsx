import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useEffect, useActionState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  endRoomOwnerLinkWithState,
  updateRoomOwnerDatesWithState,
} from "@/features/admin/actions";
import { FieldLabel } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import {
  type RoomOwnerLink,
  initialState,
  FieldError,
  stateValue,
  focusFirstInvalidField,
  mergeParams,
  ActionMessage,
} from "@/features/admin/components/ownership/ownership-helpers";

export function EditDatesDrawer({
  closeHref,
  link,
}: {
  closeHref: string;
  link: RoomOwnerLink;
}) {
  const { s } = useStaffText();
  const [state, action] = useActionState(
    updateRoomOwnerDatesWithState,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: state.recordId,
        id: null,
        message: state.success,
        mode: null,
        type: null,
      }),
    );
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        fill(s.ownership.roomSummary, { room: link.rooms?.room_number ?? "-" }),
        fill(s.ownership.ownerSummary, { owner: link.owners?.full_name ?? "-" }),
      ]}
      title={s.ownership.editDates}
    >
      <form action={action} className="grid gap-3" noValidate ref={formRef}>
        <ActionMessage state={state} />
        <input name="id" type="hidden" value={link.id} />
        <label className="grid gap-1 text-sm font-medium">
          {s.ownership.from}
          <input
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "starts_at", link.starts_at)}
            name="starts_at"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {s.ownership.until}
          <input
            {...fieldProps("ends_at", state)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "ends_at", link.ends_at)}
            name="ends_at"
            type="date"
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            {s.ownership.untilHelp}
          </span>
          <FieldError fieldName="ends_at" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <PendingSubmitButton
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            debugName="admin.ownership.edit_dates"
            pendingLabel={s.common.saving}
            type="submit"
          >
            {s.ownership.saveDates}
          </PendingSubmitButton>
          <FormResetButton label="Reset changes" />
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            {s.common.cancel}
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}

export function EndLinkDrawer({
  closeHref,
  defaultEndDate,
  link,
}: {
  closeHref: string;
  defaultEndDate: string;
  link: RoomOwnerLink;
}) {
  const { s } = useStaffText();
  const [state, action] = useActionState(endRoomOwnerLinkWithState, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (focusFirstInvalidField(formRef.current, state)) {
      return;
    }

    if (!state.success || !state.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: state.recordId,
        id: null,
        message: state.success,
        mode: null,
        type: null,
      }),
    );
  }, [searchParams, state]);

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        fill(s.ownership.roomSummary, { room: link.rooms?.room_number ?? "-" }),
        fill(s.ownership.ownerSummary, { owner: link.owners?.full_name ?? "-" }),
        fill(s.ownership.datesSummary, {
          from: link.starts_at ?? s.ownership.notSet,
          until: link.ends_at ?? s.ownership.noEnd,
        }),
      ]}
      title={s.ownership.endLink}
    >
      <form action={action} className="grid gap-3" noValidate ref={formRef}>
        <ActionMessage state={state} />
        <input name="id" type="hidden" value={link.id} />
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {s.ownership.endHelp}
        </p>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>{s.ownership.endDate}</FieldLabel>
          <input
            {...fieldProps("ends_at", state)}
            autoFocus
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            defaultValue={stateValue(state, "ends_at", defaultEndDate)}
            name="ends_at"
            required
            type="date"
          />
          <FieldError fieldName="ends_at" state={state} />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <ConfirmSubmitButton
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white"
            confirmMessage={fill(s.ownership.confirmEnd, {
              room: link.rooms?.room_number ?? "-",
              owner: link.owners?.full_name ?? "-",
            })}
            debugName="admin.ownership.end"
            pendingLabel={s.common.saving}
            type="submit"
          >
            {s.ownership.endButton}
          </ConfirmSubmitButton>
          <a
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href={closeHref}
          >
            {s.common.cancel}
          </a>
        </div>
      </form>
    </AdminCrudDrawer>
  );
}
