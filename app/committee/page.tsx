import { formatBangkokDateTime } from "@/lib/datetime";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { requireProfileWithRoles } from "@/lib/auth/permissions";
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

const formatDateTime = formatBangkokDateTime;

type PendingPayload = {
  totals?: {
    quorum?: { label?: string; met?: boolean | null } | null;
    eligible_voters?: number;
    submitted_ballots?: number;
  };
  questions?: (QuestionOutcomePayload & {
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
    redirect("/summary");
  }

  const supabase = await createClient();
  const overview = await getCommitteeOverview(supabase);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <Gavel className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">Committee</h1>
          <p className="text-sm text-[var(--muted)]">
            Approve closing voting early and approve results. Each meeting sets
            how many approvals are needed.
          </p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Voting Open</h2>
        {overview.open_meetings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No meeting is open for voting.</p>
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
                    Closes automatically {formatDateTime(meeting.ends_at)} · Close
                    approvals {meeting.close_approvals} of {meeting.required_approvals}
                  </div>
                </div>
                {meeting.approved_by_me ? (
                  <span className="text-sm text-[var(--muted)]">You approved closing</span>
                ) : (
                  <form action={approveCloseVotingAsCommittee}>
                    <input name="meeting_id" type="hidden" value={meeting.id} />
                    <ConfirmSubmitButton
                      className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
                      confirmMessage={`Approve closing voting for "${meeting.title}" now? Voting ends when ${meeting.required_approvals} committee approval(s) are recorded. This cannot be undone.`}
                      pendingLabel="Saving..."
                      type="submit"
                    >
                      Approve closing voting
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Results Awaiting Approval</h2>
        {overview.pending_results.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No result is waiting for approval.</p>
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
                    Generated {formatDateTime(result.generated_at)} · Approvals{" "}
                    {result.approvals} of {result.required_approvals}
                  </p>
                  {payload.totals?.submitted_ballots !== undefined ? (
                    <p className="mt-1 text-sm">
                      Ballots counted: {payload.totals.submitted_ballots} of{" "}
                      {payload.totals.eligible_voters ?? 0} eligible rooms
                    </p>
                  ) : null}
                  {payload.totals?.quorum?.label ? (
                    <p className="text-sm">
                      Quorum: {payload.totals.quorum.label}:{" "}
                      <span className="font-medium">
                        {payload.totals.quorum.met === null
                          ? "not evaluated"
                          : payload.totals.quorum.met
                            ? "met"
                            : "not met"}
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
                            {question.agenda_no ? `Agenda ${question.agenda_no}` : `Item ${index + 1}`}
                            {" · "}
                            {question.agenda_title ?? question.text ?? "-"}
                          </div>
                          <QuestionOutcomeLine question={question} />
                          <ChoiceResultsTable choices={question.choices} />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        This result has no agenda items.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    {result.approved_by_me ? (
                      <p className="text-sm text-[var(--muted)]">You approved this result.</p>
                    ) : (
                      <form
                        action={approveResultAsCommittee}
                        className="grid gap-2 sm:max-w-md"
                      >
                        <input name="result_snapshot_id" type="hidden" value={result.snapshot_id} />
                        <label className="grid gap-1 text-sm font-medium">
                          Approval notes (optional)
                          <input
                            className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
                            name="notes"
                          />
                        </label>
                        <ConfirmSubmitButton
                          className="min-h-11 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                          confirmMessage={`Approve the result of "${result.title}"? The result is published when ${result.required_approvals} committee approval(s) are recorded. This cannot be undone.`}
                          pendingLabel="Approving..."
                          type="submit"
                        >
                          Approve result
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
