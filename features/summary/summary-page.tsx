import Link from "next/link";
import { FileText } from "lucide-react";
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

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
                Approved meeting result with mock PDF preview.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href="/vote"
          >
            Vote dashboard
          </Link>
        </div>

        {!selected || !payload ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <h2 className="font-semibold">No approved result summary</h2>
            <p className="mt-1 text-[var(--muted)]">
              Approved meeting results will appear here after admin generates a
              result snapshot and committee approval is recorded.
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 font-medium"
              href="/vote"
            >
              Open vote dashboard
            </Link>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="border-b border-[var(--border)] pb-4 text-center">
                <p className="text-sm text-[var(--muted)]">Mock PDF Preview</p>
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
                  <p className="mt-1 text-[var(--muted)]">
                    Meeting no. {payload.meeting?.meeting_number ?? "-"} / FY{" "}
                    {payload.meeting?.fiscal_year ?? "-"}
                  </p>
                  <p className="text-[var(--muted)]">
                    Location: {payload.meeting?.location ?? "-"}
                  </p>
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
                  <p className="text-[var(--muted)]">
                    Notes: {selected.notes ?? "-"}
                  </p>
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

              <section className="mt-5">
                <h3 className="font-semibold">Agenda Results</h3>
                <div className="mt-3 grid gap-4">
                  {payload.questions?.map((question, index) => (
                    <section
                      className="rounded-md border border-[var(--border)] p-4"
                      key={`${question.agenda_no ?? index}-${question.text}`}
                    >
                      <h4 className="font-medium">
                        {question.agenda_no ?? `Item ${index + 1}`}{" "}
                        {question.agenda_title ?? question.text ?? "-"}
                      </h4>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Resolution: {question.resolution_type ?? "-"}
                      </p>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                            <tr>
                              <th className="py-2 pr-3 font-medium">Choice</th>
                              <th className="py-2 pr-3 font-medium">Rooms</th>
                              <th className="py-2 pr-3 font-medium">
                                Ownership
                              </th>
                              <th className="py-2 font-medium">Submitted %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {question.choices?.map((choice) => (
                              <tr
                                className="border-b border-[var(--border)] last:border-0"
                                key={choice.text}
                              >
                                <td className="py-2 pr-3">
                                  {choice.text ?? "-"}
                                </td>
                                <td className="py-2 pr-3">
                                  {choice.vote_count ?? 0}
                                </td>
                                <td className="py-2 pr-3">
                                  {formatPercent(choice.ownership)}
                                </td>
                                <td className="py-2">
                                  {formatPercent(
                                    choice.percent_of_submitted_ownership,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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

              <footer className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                This is a v1 mock PDF preview generated from approved snapshot
                data.
                {condoProfile?.document_footer
                  ? ` ${condoProfile.document_footer}`
                  : ""}
              </footer>
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
