import { CountedText } from "@/features/committee/counted-text";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { castDecidingVoteAsCommittee } from "@/features/committee/actions";
import type { CommitteeTally } from "@/features/results/committee-service";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { committeePositionLabel } from "@/lib/i18n/committee-position";
import { fill } from "@/lib/i18n/template";

const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";

/** A tie (D027): the chair, else the vice chair, casts the deciding vote;
 * everyone else sees who is expected to; with neither, the warning. */
export function CastingVotePanel({
  iAmChair,
  t,
  tally,
}: {
  iAmChair: boolean;
  t: StaffDictionary["committee"];
  tally: CommitteeTally;
}) {
  if (tally.status !== "tie") {
    return null;
  }

  if (!tally.chair) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-no-chair>
        {t.noChair}
      </p>
    );
  }

  const position = committeePositionLabel(t.positions, tally.chair.position, null);

  if (!iAmChair) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-tie-waiting>
        {fill(t.tieWaitChair, { position, name: tally.chair.name ?? "-" })}
      </p>
    );
  }

  const formId = `cast-${tally.subject_id}`;
  const button = "min-h-11 rounded-md px-4 py-2 text-sm font-medium";

  return (
    <form
      action={castDecidingVoteAsCommittee}
      className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
      data-casting-form
      id={formId}
    >
      <p className="font-medium">{fill(t.tieYouDecide, { position })}</p>
      <input name="kind" type="hidden" value={tally.kind} />
      <input name="subject_id" type="hidden" value={tally.subject_id} />
      <label className="grid gap-1 font-medium sm:max-w-md">
        {t.castReason}
        <CountedText className={input} maxLength={500} multiline name="reason" />
      </label>
      <div className="flex flex-wrap gap-2">
        <ConfirmSubmitButton
          className={`${button} bg-[var(--primary)] text-[var(--primary-foreground)]`}
          confirmMessage={t.confirmCast}
          name="decision"
          pendingLabel={t.saving}
          tone="primary"
          value="approve"
        >
          {t.castApprove}
        </ConfirmSubmitButton>
        <ConfirmSubmitButton
          className={`${button} bg-[var(--danger)] text-white`}
          confirmMessage={t.confirmCast}
          name="decision"
          pendingLabel={t.saving}
          value="object"
        >
          {t.castObject}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
