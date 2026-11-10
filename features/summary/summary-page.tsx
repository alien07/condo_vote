import { formatBangkokDateTime } from "@/lib/datetime";
import Link from "next/link";
import { FileText } from "lucide-react";
import { ChoiceResultsTable } from "@/features/results/choice-results-table";
import { QuestionOutcomeLine } from "@/features/results/question-outcome";
import type { ApprovedSummary } from "@/features/summary/data";

type SummaryPageProps = {
  condoProfile: {
    project_name: string;
    juristic_name: string;
    document_footer: string | null;
  } | null;
  historyLimit: number;
  selected: ApprovedSummary | null;
  history: ApprovedSummary[];
};

const formatDateTime = formatBangkokDateTime;

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export function SummaryPage({
  condoProfile,
  historyLimit,
  selected,
  history,
}: SummaryPageProps) {
  const payload = selected?.payload;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 border-b border-[var(--border)] pb-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-1 text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">Result Summary</h1>
              <p className="text-sm text-[var(--muted)]">
                Results approved by the committee.
              </p>
            </div>
          </div>
        </div>

        {!selected || !payload ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <h2 className="font-semibold">No approved result summary</h2>
            <p className="mt-1 text-[var(--muted)]">
              Results appear here after voting closes and the committee
              approves them.
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 font-medium"
              href="/vote"
            >
              Open vote dashboard
            </Link>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="border-b border-[var(--border)] pb-4 text-center">
                <p className="text-sm text-[var(--muted)]">Result document</p>
                <h2 className="mt-2 text-xl font-semibold">
                  {condoProfile?.project_name ??
                    payload.meeting?.title ??
                    "Approved result"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {condoProfile?.juristic_name ?? "Juristic person"}
                </p>
              </div>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">
                    {payload.meeting?.title ?? "Meeting"}
                  </h3>
                  {/* Show only the details this meeting has. */}
                  {payload.meeting?.meeting_number || payload.meeting?.fiscal_year ? (
                    <p className="mt-1 text-[var(--muted)]">
                      {[
                        payload.meeting?.meeting_number
                          ? `Meeting no. ${payload.meeting.meeting_number}`
                          : null,
                        payload.meeting?.fiscal_year
                          ? `FY ${payload.meeting.fiscal_year}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {payload.meeting?.location ? (
                    <p className="text-[var(--muted)]">
                      Location: {payload.meeting.location}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p>
                    Approved:{" "}
                    <span className="font-medium">
                      {formatDateTime(selected.approvedAt)}
                    </span>
                  </p>
                  <p className="text-[var(--muted)]">
                    Generated:{" "}
                    {formatDateTime(payload.generated_at ?? selected.generatedAt)}
                  </p>
                  {selected.notes ? (
                    <p className="text-[var(--muted)]">Notes: {selected.notes}</p>
                  ) : null}
                </div>
              </section>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-[var(--muted)]">Eligible</div>
                  <div className="text-lg font-semibold">
                    {payload.totals?.eligible_voters ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-[var(--muted)]">Submitted</div>
                  <div className="text-lg font-semibold">
                    {payload.totals?.submitted_ballots ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-[var(--muted)]">Submitted ownership</div>
                  <div className="text-lg font-semibold">
                    {formatPercent(payload.totals?.submitted_ownership)}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-[var(--muted)]">Total ownership</div>
                  <div className="text-lg font-semibold">
                    {formatPercent(payload.totals?.total_eligible_ownership)}
                  </div>
                </div>
              </section>
              {payload.totals?.quorum?.label ? (
                <p className="mt-3 text-sm">
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

              <section className="mt-5">
                <h3 className="font-semibold">Agenda Results</h3>
                <div className="mt-3 grid gap-4">
                  {!payload.questions?.length ? (
                    <p className="text-sm text-[var(--muted)]">
                      No agenda items were recorded for this meeting.
                    </p>
                  ) : null}
                  {payload.questions?.map((question, index) => (
                    <section
                      className="rounded-md border border-[var(--border)] p-4"
                      key={`${question.agenda_no ?? index}-${question.text}`}
                    >
                      <h4 className="font-medium">
                        {question.agenda_no ?? `Item ${index + 1}`}{" "}
                        {question.agenda_title ?? question.text ?? "-"}
                      </h4>
                      {question.resolution_type ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Resolution: {question.resolution_type}
                        </p>
                      ) : null}
                      <QuestionOutcomeLine question={question} />
                      <ChoiceResultsTable choices={question.choices} />
                    </section>
                  ))}
                </div>
              </section>

              <section className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
                <h3 className="font-semibold">Conflict And Audit Notes</h3>
                <p className="mt-1 text-[var(--muted)]">
                  Source conflicts: {payload.totals?.source_conflicts ?? 0};
                  resolved: {payload.totals?.resolved_source_conflicts ?? 0}.
                </p>
                {payload.vote_source_audit?.conflicts?.length ? (
                  <ul className="mt-2 list-disc pl-5">
                    {payload.vote_source_audit.conflicts.map((conflict, index) => (
                      <li key={`${conflict.chosen_source}-${index}`}>
                        Source: {conflict.chosen_source ?? "-"}; remark:{" "}
                        {conflict.conflict_remark ?? "-"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {condoProfile?.document_footer ? (
                <footer className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  {condoProfile.document_footer}
                </footer>
              ) : null}
            </article>

            <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-semibold">History</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Showing latest {historyLimit} approved summaries.
              </p>
              <div className="mt-4 grid gap-2">
                {history.map((summary) => (
                  <Link
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    href={`/summary/${summary.meetingId}`}
                    key={summary.id}
                  >
                    <div className="font-medium">
                      {summary.payload.meeting?.title ?? "Approved result"}
                    </div>
                    <div className="text-[var(--muted)]">
                      {formatDateTime(summary.approvedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
