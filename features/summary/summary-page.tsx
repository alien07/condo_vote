import Link from "next/link";
import { FileText } from "lucide-react";
import { ChoiceResultsTable } from "@/features/results/choice-results-table";
import { outcomeText, passRuleText, quorumText } from "@/features/results/thai-labels";
import { TranslationNote } from "@/features/i18n/translation-note";
import { localized } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDateTimeIn } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import type { ApprovedSummary, SummaryListItem } from "@/features/summary/data";
import { formatDateIn } from "@/lib/i18n/format";
import { documentFont } from "@/lib/fonts";
import { GlossaryNotes, Term } from "@/features/glossary/term";
import type { GlossaryKey } from "@/lib/i18n/glossary";

type SummaryPageProps = {
  condoProfile: {
    project_name: string;
    juristic_name: string;
    project_name_en?: string | null;
    juristic_name_en?: string | null;
    document_footer: string | null;
  } | null;
  historyLimit: number;
  locale: Locale;
  selected: ApprovedSummary | null;
  history: SummaryListItem[];
  /** All published results, for the "See all results" link. */
  totalCount: number;
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
  totalCount,
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
                  {(condoProfile ? localized(locale, condoProfile.project_name, condoProfile.project_name_en) : null) ??
                    localized(locale, payload.meeting?.title, payload.meeting?.title_en) ??
                    t.approvedResult}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {(condoProfile ? localized(locale, condoProfile.juristic_name, condoProfile.juristic_name_en) : null) ??
                    t.juristicPerson}
                </p>
              </div>

              {/* English summary: the Thai version prevails, said up front
                  (demo feedback item 6a). */}
              <TranslationNote text={t.translationNote} />

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">
                    {localized(locale, payload.meeting?.title, payload.meeting?.title_en) ?? t.meeting}
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
                      {t.location(localized(locale, payload.meeting.location, payload.meeting.location_en))}
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
                    <Term k="quorum" locale={locale}>
                      {quorumText(locale, payload.totals?.quorum)}
                    </Term>
                  </p>
                </div>
              </section>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                {(
                  [
                    ["eligibleRooms", t.eligibleRooms, String(payload.totals?.eligible_voters ?? 0)],
                    ["votedRooms", t.votedRooms, String(payload.totals?.submitted_ballots ?? 0)],
                    ["votedOwnership", t.votedOwnership, formatPercent(payload.totals?.submitted_ownership)],
                    ["totalOwnership", t.totalOwnership, formatPercent(payload.totals?.total_eligible_ownership)],
                  ] satisfies [GlossaryKey, string, string][]
                ).map(([key, label, value]) => (
                  <div className="rounded-md border border-[var(--border)] p-3" key={key}>
                    <div className="text-[var(--muted)]">
                      <Term k={key} locale={locale}>{label}</Term>
                    </div>
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
                      .map((choice) => localized(locale, choice.text, choice.text_en) ?? "-");
                    const questionText = localized(locale, question.text, question.text_en);
                    const agendaTitle = localized(locale, question.agenda_title, question.agenda_title_en);

                    return (
                      <section
                        className="rounded-md border border-[var(--border)] p-4"
                        key={`${question.agenda_no ?? index}-${question.text}`}
                      >
                        <h4 className="font-medium">
                          {t.agendaItem(String(question.agenda_no ?? index + 1))}{" "}
                          {agendaTitle ?? questionText ?? "-"}
                        </h4>
                        {agendaTitle && questionText ? (
                          <p className="mt-1 text-sm">{questionText}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          <Term k="rule" locale={locale}>{t.rule}</Term>:{" "}
                          {passRuleText(locale, question.pass_rule)}
                        </p>
                        <p className="mt-1 text-sm font-semibold" data-outcome={question.outcome ?? undefined}>
                          <Term
                            k={question.outcome === "informational" ? "informational" : "outcome"}
                            locale={locale}
                          >
                            {outcomeText(locale, question.outcome, decided)}
                          </Term>
                        </p>
                        <ChoiceResultsTable
                          choices={question.choices?.map((choice) => ({
                            ...choice,
                            text: localized(locale, choice.text, choice.text_en) ?? undefined,
                          }))}
                          locale={locale}
                          ruleBasis={question.pass_rule?.basis}
                        />
                      </section>
                    );
                  })}
                </div>
                {/* Printed summary and PDF: the "i" tips as notes. */}
                <GlossaryNotes
                  keys={["rooms", "shareOfAll", "shareOfCast", "rule", "outcome", "abstain", "quorum"]}
                  locale={locale}
                  printOnly
                />
              </section>

              <section className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
                <h3 className="font-semibold">
                  <Term k="summaryVsOfficial" locale={locale}>{t.verifyTitle}</Term>
                </h3>
                <p className="mt-1 text-[var(--muted)]">
                  {t.verifyText}
                </p>
                <p className="mt-2">
                  <Term k="reference" locale={locale}>{t.reference}</Term>{" "}
                  <span className="font-mono text-xs">{selected.snapshotId}</span>
                </p>
                {selected.payloadSha256 ? (
                  <p className="break-all">
                    <Term k="sha256" locale={locale}>SHA-256</Term>{" "}
                    <span className="font-mono text-xs">{selected.payloadSha256}</span>
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
                  const current = summary.meetingId === selected.meetingId;

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
                      <div className="font-medium">{summary.title ?? t.approvedResult}</div>
                      {summary.meetingStartsAt ? (
                        <div className="text-[var(--muted)]">
                          {t.meetingOn(formatDateIn(locale, summary.meetingStartsAt))}
                        </div>
                      ) : null}
                      <div className="text-xs text-[var(--muted)]">
                        {t.publishedOn(formatDateIn(locale, summary.publishedAt))}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:border-[var(--primary)]"
                href="/summary/archive"
              >
                {t.seeAll(totalCount)}
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
