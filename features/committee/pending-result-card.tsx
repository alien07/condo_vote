import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import { ApproverList } from "@/features/committee/approver-list";
import { changedAgendaItems } from "@/features/committee/changed-items";
import {
  approveResultAsCommittee,
  requestCorrectionAsCommittee,
} from "@/features/committee/actions";
import type { CommitteeOverview } from "@/features/results/committee-service";
import { ChoiceResultsTable, type ChoiceResult } from "@/features/results/choice-results-table";
import {
  QuestionOutcomeLine,
  type QuestionOutcomePayload,
} from "@/features/results/question-outcome";
import { quorumText } from "@/features/results/thai-labels";
import { Term } from "@/features/glossary/term";
import type { Locale } from "@/lib/i18n/locales";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { codeLabel, fill } from "@/lib/i18n/template";

type PendingResult = CommitteeOverview["pending_results"][number];

type PendingPayload = {
  totals?: {
    quorum?: { label?: string; required_percent?: number | null; met?: boolean | null } | null;
    eligible_voters?: number;
    submitted_ballots?: number;
  };
  questions?: (QuestionOutcomePayload & {
    pass_rule?: { basis?: string } | null;
    agenda_no?: string | null;
    agenda_title?: string | null;
    text?: string;
    choices?: ChoiceResult[];
  })[];
};

const CATEGORIES = ["wording", "room_data", "voting_rights", "paper_ballot", "pass_rule", "other"];
const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";

/** A result waiting for approval: counts, who approved, corrections, and the
 * approve and correction forms (demo feedback items 11 and 12). */
export function PendingResultCard({
  result,
  members,
  locale,
  formatDateTime,
  t,
}: {
  result: PendingResult;
  members: CommitteeOverview["members"];
  locale: Locale;
  formatDateTime: (value: string) => string;
  t: StaffDictionary["committee"];
}) {
  const payload = (result.payload ?? {}) as PendingPayload;
  const more = Math.max(result.required_approvals - result.approvals, 0);
  const openHigh = result.corrections.some(
    (correction) => correction.level === "high" && correction.status !== "no_change",
  );
  const changed = result.previous_payload
    ? changedAgendaItems(result.previous_payload as PendingPayload, payload)
    : null;
  const regeneratedAfter = result.corrections.find(
    (correction) => correction.result_snapshot_id !== result.snapshot_id,
  );

  return (
    <section
      className="rounded-md border border-[var(--border)] p-4"
      data-result-snapshot-id={result.snapshot_id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{result.title}</h3>
        {result.approved_by_me ? (
          <span
            className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]"
            data-you-approved
          >
            {t.youApproved}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-[var(--muted)]">
        {fill(t.generated, { time: formatDateTime(result.generated_at) })}
      </p>
      <p className="text-sm" data-approval-count>
        <Term
          extra={
            <ApproverList
              entries={result.approval_list.map((approval) => ({
                profileId: approval.profile_id,
                name: approval.name,
                kind: "approve" as const,
                at: approval.approved_at,
                note: approval.notes,
              }))}
              formatTime={formatDateTime}
              members={members}
              text={t}
            />
          }
          k="approvals"
          locale={locale}
        >
          {more > 0
            ? fill(t.countMore, { count: result.approvals, required: result.required_approvals, more })
            : fill(t.countDone, { count: result.approvals, required: result.required_approvals })}
        </Term>
      </p>
      {openHigh ? <p className="mt-1 text-sm font-medium text-[var(--danger)]">{t.allMembersNeeded}</p> : null}

      {regeneratedAfter ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-regenerated>
          {fill(t.regenerated, { reason: regeneratedAfter.reason })}{" "}
          {changed && changed.length > 0
            ? fill(t.changedAgenda, { items: changed.join(", ") })
            : t.numbersUnchanged}
        </p>
      ) : null}

      {result.corrections.length > 0 ? (
        <div className="mt-3 grid gap-2 text-sm" data-corrections>
          <div className="font-medium">{t.correctionsTitle}</div>
          {result.corrections.map((correction) => (
            <div
              className={`rounded-md border px-3 py-2 ${
                correction.level === "high" ? "border-[var(--danger)]" : "border-[var(--border)]"
              }`}
              key={correction.id}
            >
              <div className="font-medium">
                {codeLabel(t.categories, correction.category)} ·{" "}
                {fill(t.correctionLevel, { level: codeLabel(t.levels, correction.level) })} ·{" "}
                {codeLabel(t.correctionStatus, correction.status)}
              </div>
              <div className="text-[var(--muted)]">
                {fill(t.correctionBy, {
                  name: correction.requester ?? "-",
                  time: formatDateTime(correction.created_at),
                })}
              </div>
              <div>{correction.reason}</div>
              {correction.legal_reference ? <div>{correction.legal_reference}</div> : null}
              {correction.level_change_reason ? (
                <div>{fill(t.correctionLevelRaised, { reason: correction.level_change_reason })}</div>
              ) : null}
              {correction.answer ? (
                <div>{fill(t.correctionAnswer, { answer: correction.answer })}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {payload.totals?.submitted_ballots !== undefined ? (
        <p className="mt-3 text-sm">
          <Term k="ballotsCounted" locale={locale}>
            {fill(t.ballotsCounted, {
              count: payload.totals.submitted_ballots,
              eligible: payload.totals.eligible_voters ?? 0,
            })}
          </Term>
        </p>
      ) : null}
      {payload.totals?.quorum?.label ? (
        <p className="text-sm">
          <Term k="quorum" locale={locale}>{t.quorum}</Term>:{" "}
          <span className="font-medium">
            {payload.totals.quorum.required_percent === undefined
              ? `${payload.totals.quorum.label}: ${
                  payload.totals.quorum.met === null
                    ? t.notEvaluated
                    : payload.totals.quorum.met
                      ? t.met
                      : t.notMet
                }`
              : quorumText(locale, payload.totals.quorum)}
          </span>
        </p>
      ) : null}

      <div className="mt-4 grid gap-4">
        {payload.questions?.length ? (
          payload.questions.map((question, index) => (
            <div
              className="border-t border-[var(--border)] pt-3 text-sm"
              key={`${result.snapshot_id}-${index}`}
            >
              <div className="font-medium">
                {question.agenda_no
                  ? fill(t.agenda, { no: question.agenda_no })
                  : fill(t.item, { no: index + 1 })}
                {" · "}
                {question.agenda_title ?? question.text ?? "-"}
              </div>
              <QuestionOutcomeLine locale={locale} question={question} />
              <ChoiceResultsTable
                choices={question.choices}
                locale={locale}
                ruleBasis={question.pass_rule?.basis}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">{t.noItems}</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        {result.approved_by_me ? (
          <p className="text-sm text-[var(--muted)]">{t.youApprovedResult}</p>
        ) : (
          <form action={approveResultAsCommittee} className="grid gap-2">
            <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
            <label className="grid gap-1 text-sm font-medium">
              {t.notes}
              <input className={input} name="notes" />
            </label>
            <ConfirmSubmitButton
              className="min-h-11 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              confirmMessage={fill(t.confirmApprove, {
                title: result.title,
                required: result.required_approvals,
              })}
              pendingLabel={t.approving}
            >
              {t.approveResult}
            </ConfirmSubmitButton>
          </form>
        )}

        <details className="text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[var(--border)] px-3 py-2 font-medium">
            {t.requestCorrection}
          </summary>
          <form action={requestCorrectionAsCommittee} className="mt-3 grid gap-2">
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
              <textarea className={input} name="reason" required rows={2} />
            </label>
            <label className="grid gap-1 font-medium">
              {t.correctionReference}
              <input className={input} name="legal_reference" />
            </label>
            <ConfirmSubmitButton
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
              confirmMessage={fill(t.confirmCorrection, { title: result.title })}
              pendingLabel={t.saving}
              tone="primary"
            >
              {t.requestCorrection}
            </ConfirmSubmitButton>
          </form>
        </details>
      </div>
    </section>
  );
}
