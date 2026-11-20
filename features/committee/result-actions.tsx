import { CountedText } from "@/features/committee/counted-text";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import { ActionRow, ActionRowCancel } from "@/features/ui/action-row";
import {
  approveResultAsCommittee,
  objectResultAsCommittee,
  requestCorrectionAsCommittee,
} from "@/features/committee/actions";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

const CATEGORIES = ["wording", "room_data", "voting_rights", "paper_ballot", "pass_rule", "other"];
const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";

/**
 * Approve, "do not approve" (with a reason, D027) and "request a correction"
 * for a result (review 2026-11-15): one row of buttons, the optional note
 * folded behind "+ Add a note", each reason form opening below the row.
 */
export function ResultActions({
  canRequestCorrection,
  openCorrection,
  result,
  t,
  title,
}: {
  canRequestCorrection: boolean;
  openCorrection: boolean;
  result: { snapshot_id: string; tally: { required: number; members: number } };
  t: StaffDictionary["committee"];
  title: string;
}) {
  return (
      <div className="grid gap-3 border-t border-[var(--border)] pt-4" data-result-actions>
        {/* The optional note belongs to the approve form (form attribute), so
            approve and "request a correction" can sit in one row of buttons
            (review 2026-11-15). */}
        <details className="text-sm" data-approval-note>
          <summary className="tap-target inline-flex cursor-pointer items-center text-[var(--primary)] underline">
            {t.addNote}
          </summary>
          <label className="mt-2 grid gap-1 font-medium sm:max-w-md">
            {t.notes}
            <CountedText className={input} form={`approve-${result.snapshot_id}`} maxLength={500} name="notes" />
          </label>
        </details>
        {(() => {
          const approveForm = (
            <form action={approveResultAsCommittee} id={`approve-${result.snapshot_id}`}>
              <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
              <ConfirmSubmitButton
                className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                confirmMessage={fill(t.confirmApprove, {
                  title,
                  required: result.tally.required,
                  members: result.tally.members,
                })}
                pendingLabel={t.approving}
              >
                {t.approveResult}
              </ConfirmSubmitButton>
            </form>
          );

          const toggle =
            "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium";
          const objectForm = (
            <form action={objectResultAsCommittee} className="grid gap-3 text-sm sm:max-w-md" data-result-object-form>
              <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
              <label className="grid gap-1 font-medium">
                <span>
                  {t.objectResultReason} <RequiredMark />
                </span>
                <CountedText className={input} maxLength={500} multiline name="reason" required />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <ActionRowCancel
                  className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                  label={t.cancel}
                />
                <ConfirmSubmitButton
                  className="min-h-11 rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white"
                  confirmMessage={fill(t.confirmObjectResult, { title })}
                  pendingLabel={t.saving}
                >
                  {t.sendResultObjection}
                </ConfirmSubmitButton>
              </div>
            </form>
          );

          // The reason forms open below the row; the buttons stay put.
          return (
            <ActionRow
              actions={approveForm}
              data-correction-form
              panel={objectForm}
              toggleClassName={toggle}
              toggleLabel={t.objectResult}
              more={canRequestCorrection ? [{
                key: "correction",
                label: t.requestCorrection,
                className: toggle,
                panel: (
                <form action={requestCorrectionAsCommittee} className="grid gap-3 text-sm">
                  <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
                  <label className="grid gap-1 font-medium">
                    <span>
                      {t.correctionCategory} <RequiredMark />
                    </span>
                    <select className={input} defaultValue="" name="category" required>
                      <option disabled value="">
                        -
                      </option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {t.categories[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 font-medium">
                    <span>
                      {t.correctionReason} <RequiredMark />
                    </span>
                    <CountedText className={input} maxLength={500} multiline name="reason" required />
                  </label>
                  <label className="grid gap-1 font-medium">
                    {t.correctionReference}
                    <CountedText className={input} maxLength={200} name="legal_reference" />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionRowCancel
                      className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                      label={t.cancel}
                    />
                    <ConfirmSubmitButton
                      className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                      confirmMessage={fill(t.confirmCorrection, { title })}
                      pendingLabel={t.saving}
                      tone="primary"
                    >
                      {t.sendCorrection}
                    </ConfirmSubmitButton>
                  </div>
                </form>
                ),
              }] : []}
            />
          );
        })()}

        {openCorrection ? (
          <p className="text-sm text-[var(--muted)]" data-correction-waiting>
            {t.correctionWaiting}
          </p>
        ) : null}
      </div>
  );
}
