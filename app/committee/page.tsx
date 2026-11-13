import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCommitteeOverview } from "@/features/results/committee-service";
import {
  approveCloseVotingAsCommittee,
  approveResultAsCommittee,
} from "@/features/committee/actions";
import {
  QuestionOutcomeLine,
  type QuestionOutcomePayload,
} from "@/features/results/question-outcome";
import { ChoiceResultsTable, type ChoiceResult } from "@/features/results/choice-results-table";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { Term } from "@/features/glossary/term";
import { quorumText } from "@/features/results/thai-labels";

// Approving can start the master PDF files (D021), which needs Chromium time.
export const maxDuration = 60;

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

// Committee approvals (D014): close voting early and approve results.
export default async function CommitteePage() {
  const current = await requireProfileWithRoles();

  if (!current.roles.includes("committee") && !current.roles.includes("admin")) {
    redirect(DENIED_PATH);
  }

  const supabase = await createClient();
  const overview = await getCommitteeOverview(supabase);
  const { locale, s } = await getStaffI18n();
  const t = s.committee;
  const formatDateTime = (value: string) => formatDateTimeIn(locale, value);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <Gavel className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.intro}
          </p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">{t.votingOpen}</h2>
        {overview.open_meetings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t.noOpen}</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {overview.open_meetings.map((meeting) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] p-4"
                data-meeting-id={meeting.id}
                key={meeting.id}
              >
                <div>
                  <div className="font-medium">{meeting.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    <Term k="approveClose" locale={locale}>
                      {fill(t.closesAuto, {
                        time: formatDateTime(meeting.ends_at),
                        count: meeting.close_approvals,
                        required: meeting.required_approvals,
                      })}
                    </Term>
                  </div>
                </div>
                {meeting.approved_by_me ? (
                  <span className="text-sm text-[var(--muted)]">{t.youApprovedClosing}</span>
                ) : (
                  <form action={approveCloseVotingAsCommittee}>
                    <input name="meeting_id" type="hidden" value={meeting.id} />
                    <ConfirmSubmitButton
                      className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
                      confirmMessage={fill(t.confirmClose, {
                        title: meeting.title,
                        required: meeting.required_approvals,
                      })}
                      pendingLabel={t.saving}
                      type="submit"
                    >
                      {t.approveClose}
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.awaiting}</h2>
        {overview.pending_results.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t.noPending}</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {overview.pending_results.map((result) => {
              const payload = (result.payload ?? {}) as PendingPayload;

              return (
                <section
                  className="rounded-md border border-[var(--border)] p-4"
                  data-result-snapshot-id={result.snapshot_id}
                  key={result.snapshot_id}
                >
                  {/* Read the result first, then approve (details above the form). */}
                  <h3 className="font-semibold">{result.title}</h3>
                  <p className="text-sm text-[var(--muted)]">
                    <Term k="approvals" locale={locale}>
                      {fill(t.generated, {
                        time: formatDateTime(result.generated_at),
                        count: result.approvals,
                        required: result.required_approvals,
                      })}
                    </Term>
                  </p>
                  {payload.totals?.submitted_ballots !== undefined ? (
                    <p className="mt-1 text-sm">
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
                      <p className="text-sm text-[var(--muted)]">
                        {t.noItems}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    {result.approved_by_me ? (
                      <p className="text-sm text-[var(--muted)]">{t.youApprovedResult}</p>
                    ) : (
                      <form
                        action={approveResultAsCommittee}
                        className="grid gap-2 sm:max-w-md"
                      >
                        <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
                        <label className="grid gap-1 text-sm font-medium">
                          {t.notes}
                          <input
                            className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
                            name="notes"
                          />
                        </label>
                        <ConfirmSubmitButton
                          className="min-h-11 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                          confirmMessage={fill(t.confirmApprove, {
                            title: result.title,
                            required: result.required_approvals,
                          })}
                          pendingLabel={t.approving}
                          type="submit"
                        >
                          {t.approveResult}
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
