import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { useActionState, useEffect, useRef } from "react";
import { resolveVoteSourceConflictWithState } from "@/features/admin/actions";
import { FormResetButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import {
  type VoteConflictRow,
  emptyConflictState,
} from "@/features/admin/components/vote-conflicts/conflict-helpers";

export function ResolveConflictForm({
  conflict,
  onResolved,
}: {
  conflict: VoteConflictRow;
  onResolved: (recordKey: string) => void;
}) {
  const tm = useMessageText();
  const { s } = useStaffText();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    resolveVoteSourceConflictWithState,
    emptyConflictState,
  );

  useEffect(() => {
    const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

    if (firstInvalidField) {
      const field = formRef.current?.elements.namedItem(firstInvalidField);
      const element =
        field instanceof RadioNodeList
          ? field[0]
          : field instanceof HTMLElement
            ? field
            : null;

      element?.focus();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (state.success && state.recordKey) {
      onResolved(state.recordKey);
    }
  }, [onResolved, state]);

  return (
    <form action={formAction} className="mt-5 grid gap-3" noValidate ref={formRef}>
      {state.error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          role="alert"
        >
          {tm(state.error)}
        </div>
      ) : null}
      <input name="meeting_id" type="hidden" value={conflict.meetingId} />
      <input name="room_id" type="hidden" value={conflict.roomId} />
      <input
        name="online_ballot_id"
        type="hidden"
        value={conflict.onlineBallotId}
      />
      <input
        name="manual_ballot_id"
        type="hidden"
        value={conflict.manualBallotId}
      />
      <label className="grid gap-1 text-sm font-medium">
        {s.voting.chosenSource}
        <select
          aria-invalid={state.fieldErrors?.chosen_source ? "true" : undefined}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={
            state.values?.chosen_source ??
            conflict.resolution?.chosen_source ??
            "manual"
          }
          name="chosen_source"
        >
          <option value="manual">{s.voting.manual}</option>
          <option value="online">{s.voting.online}</option>
        </select>
        {state.fieldErrors?.chosen_source ? (
          <p className="text-xs font-medium text-red-700">
            {state.fieldErrors.chosen_source}
          </p>
        ) : null}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {s.voting.remark}
        <textarea
          className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          defaultValue={
            state.values?.conflict_remark ??
            conflict.resolution?.conflict_remark ??
            ""
          }
          name="conflict_remark"
          placeholder={s.voting.remarkPlaceholder}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <PendingSubmitButton
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          pendingLabel={s.common.saving}
          type="submit"
        >
          {s.voting.resolveSource}
        </PendingSubmitButton>
        <FormResetButton label="Reset changes" />
      </div>
    </form>
  );
}
