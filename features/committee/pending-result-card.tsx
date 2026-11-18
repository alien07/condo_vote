import { LongText } from "@/features/ui/long-text";
import { ApproverList } from "@/features/committee/approver-list";
import { changedAgendaItems } from "@/features/committee/changed-items";
import { ResultActions } from "@/features/committee/result-actions";
import { ResultAgenda, type AgendaQuestion, type VoterComment } from "@/features/committee/result-agenda";
import { ResultCorrections } from "@/features/committee/result-corrections";
import type { CommitteeOverview } from "@/features/results/committee-service";
import { quorumText } from "@/features/results/thai-labels";
import { Term } from "@/features/glossary/term";
import { localized } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/locales";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

type PendingResult = CommitteeOverview["pending_results"][number];

type PendingPayload = {
  totals?: {
    quorum?: { label?: string; required_percent?: number | null; met?: boolean | null } | null;
    eligible_voters?: number;
    submitted_ballots?: number;
  };
  questions?: AgendaQuestion[];
};


/** A result waiting for approval: counts, who approved, corrections, and the
 * approve and correction forms (demo feedback items 11 and 12). */
export function PendingResultCard({
  comments,
  result,
  members,
  locale,
  formatDateTime,
  t,
}: {
  comments?: VoterComment[];
  result: PendingResult;
  members: CommitteeOverview["members"];
  locale: Locale;
  formatDateTime: (value: string) => string;
  t: StaffDictionary["committee"];
}) {
  const payload = (result.payload ?? {}) as PendingPayload;
  // English text when the reader uses English and it was written (D020).
  const title = localized(locale, result.title, result.title_en);
  const more = Math.max(result.required_approvals - result.approvals, 0);
  const openHigh = result.corrections.some(
    (correction) => correction.level === "high" && correction.status !== "no_change",
  );
  const changed = result.previous_payload
    ? changedAgendaItems(result.previous_payload as PendingPayload, payload)
    : null;
  // Members who have not approved yet, shown on the card (review 2026-11-14)
  // as well as in the "i" list.
  const approvedIds = new Set(result.approval_list.map((approval) => approval.profile_id));
  const waitingFor = members.filter((member) => !approvedIds.has(member.profile_id));
  // One open correction per result (0034): others see it instead of the form.
  const openCorrection = result.corrections.some((correction) => correction.status === "open");
  // Approvals complete, but publishing waits for the admin's answer.
  const held = openCorrection && result.approvals >= result.required_approvals;
  // A member who approved has said the numbers are correct (0034).
  const canRequestCorrection = !result.approved_by_me && !openCorrection;
  const regeneratedAfter = result.corrections.find(
    (correction) => correction.result_snapshot_id !== result.snapshot_id,
  );

  return (
    <section
      className="grid gap-3 rounded-md border border-[var(--border)] p-4 [&>*]:min-w-0"
      data-result-snapshot-id={result.snapshot_id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
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
      {result.approval_list.length > 0 ? (
        <p className="text-xs text-[var(--muted)]" data-approved-by>
          {fill(t.approvedBy, { names: result.approval_list.map((approval) => approval.name ?? "-").join(", ") })}
        </p>
      ) : null}
      {waitingFor.length > 0 ? (
        <p className="text-xs" data-not-approved>
          <span className="font-medium">{t.notApprovedYet}</span>{" "}
          {waitingFor.map((member) => member.name).join(", ")}
        </p>
      ) : null}
      {openHigh ? <p className="text-sm font-medium text-[var(--danger)]">{t.allMembersNeeded}</p> : null}
      {held ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-publish-held>
          {t.publishHeld}
        </p>
      ) : null}

      {/* Summary numbers first; they are what members check. */}
      <div className="grid gap-0.5 text-sm" data-result-totals>
        {payload.totals?.submitted_ballots !== undefined ? (
          <p>
            <Term k="ballotsCounted" locale={locale}>
              {fill(t.ballotsCounted, {
                count: payload.totals.submitted_ballots,
                eligible: payload.totals.eligible_voters ?? 0,
              })}
            </Term>
          </p>
        ) : null}
        {payload.totals?.quorum?.label ? (
          <p>
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
      </div>

      <ResultAgenda
        comments={comments}
        locale={locale}
        questions={payload.questions}
        snapshotId={result.snapshot_id}
        t={t}
      />

      {regeneratedAfter ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-regenerated>
          <span className="block font-medium">
            {changed && changed.length > 0
              ? `${t.labelRegenerated} · ${fill(t.changedAgenda, { items: changed.join(", ") })}`
              : `${t.labelRegenerated} · ${t.numbersUnchanged}`}
          </span>
          <LongText less={t.showLess} lines={2} more={t.showMore} text={regeneratedAfter.reason} />
        </div>
      ) : null}

      <ResultCorrections corrections={result.corrections} formatDateTime={formatDateTime} t={t} />

      {/* Someone who approved has nothing left to do here: the badge at the
          top says so. */}
      {result.approved_by_me ? null : (
        <ResultActions
          canRequestCorrection={canRequestCorrection}
          openCorrection={openCorrection}
          result={result}
          t={t}
          title={title}
        />
      )}
    </section>
  );
}
