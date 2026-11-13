import Link from "next/link";
import { FileText } from "lucide-react";
import { ChoiceResultsTable } from "@/features/results/choice-results-table";
import { outcomeText, passRuleText, quorumText } from "@/features/results/thai-labels";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDateTimeIn } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import type { ApprovedSummary } from "@/features/summary/data";
import { documentFont } from "@/lib/fonts";

type SummaryPageProps = {
  condoProfile: {
    project_name: string;
    juristic_name: string;
    document_footer: string | null;
  } | null;
  historyLimit: number;
  locale: Locale;
  selected: ApprovedSummary | null;
  history: ApprovedSummary[];
};

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export function SummaryPage({
  condoProfile,
  historyLimit,
  locale,
  selected,
  history,
}: SummaryPageProps) {
  const t = getDictionary(locale).summary;
  const formatDateTime = (value: string) => formatDateTimeIn(locale, value);
  const payload = selected?.payload;

  return (
    <main className="min-h-screen px-6 py-8 print:min-h-0 print:p-0" lang={locale}>
      {/* A4 margins for printing and the master PDF (D021). */}
      <style>{`@page { size: A4; margin: 16mm 14mm; }`}</style>
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 border-b border-[var(--border)] pb-5 md:flex-row md:items-start md:justify-between print:hidden">
          <div className="flex items-start gap-3">
            <FileText className="mt-1 text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">{t.title}</h1>
              <p className="text-sm text-[var(--muted)]">
                {t.intro}
              </p>
            </div>
          </div>
        </div>

        {!selected || !payload ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <h2 className="font-semibold">{t.emptyTitle}</h2>
            <p className="mt-1 text-[var(--muted)]">
              {t.emptyText}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 font-medium"
              href="/vote"
            >
              {t.openVote}
            </Link>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_280px] print:block">
            {/* Owner summary (document 2): totals only, no names or per-room
                choices (PDPA); the official record stays with the juristic
                person and can be checked by its reference and SHA-256. */}
            <article
              className={`${documentFont.className} rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm print:border-0 print:p-0 print:shadow-none`}
            >
              <div className="border-b border-[var(--border)] pb-4 text-center">
                <p className="text-sm text-[var(--muted)]">{t.documentTitle}</p>
                <h2 className="mt-2 text-xl font-semibold">
                  {condoProfile?.project_name ??
                    payload.meeting?.title ??
                    t.approvedResult}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {condoProfile?.juristic_name ?? t.juristicPerson}
                </p>
              </div>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">
                    {payload.meeting?.title ?? t.meeting}
                  </h3>
                  {payload.meeting?.meeting_number || payload.meeting?.fiscal_year ? (
                    <p className="mt-1 text-[var(--muted)]">
                      {[
                        payload.meeting?.meeting_number
                          ? t.meetingNumber(String(payload.meeting.meeting_number))
                          : null,
                        payload.meeting?.fiscal_year
                          ? t.fiscalYear(String(payload.meeting.fiscal_year))
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {payload.meeting?.location ? (
                    <p className="text-[var(--muted)]">
                      {t.location(payload.meeting.location)}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p>
                    {t.publishedAt}{" "}
                    <span className="font-medium">
                      {formatDateTime(selected.approvedAt)}
                    </span>
                  </p>
                  <p className="text-[var(--muted)]">
                    {quorumText(locale, payload.totals?.quorum)}
                  </p>
                </div>
              </section>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                {[
                  [t.eligibleRooms, String(payload.totals?.eligible_voters ?? 0)],
                  [t.votedRooms, String(payload.totals?.submitted_ballots ?? 0)],
                  [t.votedOwnership, formatPercent(payload.totals?.submitted_ownership)],
                  [t.totalOwnership, formatPercent(payload.totals?.total_eligible_ownership)],
                ].map(([label, value]) => (
                  <div className="rounded-md border border-[var(--border)] p-3" key={label}>
                    <div className="text-[var(--muted)]">{label}</div>
                    <div className="text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </section>

              <section className="mt-5">
                <h3 className="font-semibold">{t.agendaResults}</h3>
                <div className="mt-3 grid gap-4">
                  {!payload.questions?.length ? (
                    <p className="text-sm text-[var(--muted)]">{t.noQuestions}</p>
                  ) : null}
                  {payload.questions?.map((question, index) => {
                    const decided = (question.choices ?? [])
                      .filter((choice) => choice.id && question.passed_choice_ids?.includes(choice.id))
                      .map((choice) => choice.text ?? "-");

                    return (
                      <section
                        className="rounded-md border border-[var(--border)] p-4"
                        key={`${question.agenda_no ?? index}-${question.text}`}
                      >
                        <h4 className="font-medium">
                          {t.agendaItem(String(question.agenda_no ?? index + 1))}{" "}
                          {question.agenda_title ?? question.text ?? "-"}
                        </h4>
                        {question.agenda_title && question.text ? (
                          <p className="mt-1 text-sm">{question.text}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {t.rule}: {passRuleText(locale, question.pass_rule)}
                        </p>
                        <p className="mt-1 text-sm font-semibold" data-outcome={question.outcome ?? undefined}>
                          {outcomeText(locale, question.outcome, decided)}
                        </p>
                        <ChoiceResultsTable choices={question.choices} locale={locale} />
                      </section>
                    );
                  })}
                </div>
              </section>

              {t.translationNote ? (
                <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {t.translationNote}
                </p>
              ) : null}

              <section className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
                <h3 className="font-semibold">{t.verifyTitle}</h3>
                <p className="mt-1 text-[var(--muted)]">
                  {t.verifyText}
                </p>
                <p className="mt-2">
                  {t.reference} <span className="font-mono text-xs">{selected.snapshotId}</span>
                </p>
                {selected.payloadSha256 ? (
                  <p className="break-all">
                    SHA-256 <span className="font-mono text-xs">{selected.payloadSha256}</span>
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-x-4 print:hidden">
                  <Link
                    className="inline-flex min-h-11 items-center font-medium text-[var(--primary)] underline"
                    href={`/verify/${selected.snapshotId}`}
                  >
                    {t.verifyLink}
                  </Link>
                  {selected.pdfFiles.includes(`summary-${locale}`) ? (
                    <a
                      className="inline-flex min-h-11 items-center font-medium text-[var(--primary)] underline"
                      href={`/result-files/${selected.snapshotId}/summary-${locale}.pdf`}
                    >
                      {t.downloadPdf}
                    </a>
                  ) : null}
                </div>
              </section>

              {condoProfile?.document_footer ? (
                <footer className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  {condoProfile.document_footer}
                </footer>
              ) : null}
            </article>

            <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 print:hidden">
              <h2 className="font-semibold">{t.historyTitle}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {t.historyText(historyLimit)}
              </p>
              <div className="mt-4 grid gap-2">
                {history.map((summary) => {
                  // The result shown on the left is marked in the history.
                  const current = summary.id === selected.id;

                  return (
                    <Link
                      aria-current={current ? "page" : undefined}
                      className={[
                        "rounded-md border px-3 py-2 text-sm",
                        current
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-[inset_4px_0_0_var(--primary)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]",
                      ].join(" ")}
                      href={`/summary/${summary.meetingId}`}
                      key={summary.id}
                    >
                      {current ? (
                        <div className="mb-1 text-xs font-semibold text-[var(--primary)]">
                          {t.showing}
                        </div>
                      ) : null}
                      <div className="font-medium">
                        {summary.payload.meeting?.title ?? t.approvedResult}
                      </div>
                      <div className="text-[var(--muted)]">
                        {formatDateTime(summary.approvedAt)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
