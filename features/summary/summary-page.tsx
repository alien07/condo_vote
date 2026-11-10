import { formatBangkokDateTime, formatThaiDateTime } from "@/lib/datetime";
import Link from "next/link";
import { FileText } from "lucide-react";
import { ChoiceResultsTable } from "@/features/results/choice-results-table";
import { thaiOutcome, thaiPassRule, thaiQuorum } from "@/features/results/thai-labels";
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
            {/* Owner summary (document 2): totals only, no names or per-room
                choices (PDPA); the official record stays with the juristic
                person and can be checked by its reference and SHA-256. */}
            <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="border-b border-[var(--border)] pb-4 text-center">
                <p className="text-sm text-[var(--muted)]">ประกาศผลการลงมติ (ฉบับสรุป)</p>
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
                  {payload.meeting?.meeting_number || payload.meeting?.fiscal_year ? (
                    <p className="mt-1 text-[var(--muted)]">
                      {[
                        payload.meeting?.meeting_number
                          ? `ครั้งที่ ${payload.meeting.meeting_number}`
                          : null,
                        payload.meeting?.fiscal_year
                          ? `ปีบัญชี ${payload.meeting.fiscal_year}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {payload.meeting?.location ? (
                    <p className="text-[var(--muted)]">
                      สถานที่/ช่องทาง: {payload.meeting.location}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p>
                    เผยแพร่ผลเมื่อ{" "}
                    <span className="font-medium">
                      {formatThaiDateTime(selected.approvedAt)}
                    </span>
                  </p>
                  <p className="text-[var(--muted)]">
                    {thaiQuorum(payload.totals?.quorum)}
                  </p>
                </div>
              </section>

              <section className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                {[
                  ["ห้องที่มีสิทธิ์", String(payload.totals?.eligible_voters ?? 0)],
                  ["ห้องที่ลงคะแนน", String(payload.totals?.submitted_ballots ?? 0)],
                  ["คะแนนเสียงที่ลงคะแนน", formatPercent(payload.totals?.submitted_ownership)],
                  ["คะแนนเสียงรวม", formatPercent(payload.totals?.total_eligible_ownership)],
                ].map(([label, value]) => (
                  <div className="rounded-md border border-[var(--border)] p-3" key={label}>
                    <div className="text-[var(--muted)]">{label}</div>
                    <div className="text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </section>

              <section className="mt-5">
                <h3 className="font-semibold">ผลรายวาระ</h3>
                <div className="mt-3 grid gap-4">
                  {!payload.questions?.length ? (
                    <p className="text-sm text-[var(--muted)]">ไม่มีวาระในการลงมติครั้งนี้</p>
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
                          วาระที่ {question.agenda_no ?? index + 1}{" "}
                          {question.agenda_title ?? question.text ?? "-"}
                        </h4>
                        {question.agenda_title && question.text ? (
                          <p className="mt-1 text-sm">{question.text}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          เกณฑ์: {thaiPassRule(question.pass_rule)}
                        </p>
                        <p className="mt-1 text-sm font-semibold" data-outcome={question.outcome ?? undefined}>
                          {thaiOutcome(question.outcome, decided)}
                        </p>
                        <ChoiceResultsTable choices={question.choices} lang="th" />
                      </section>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
                <h3 className="font-semibold">ตรวจสอบกับฉบับทางการ</h3>
                <p className="mt-1 text-[var(--muted)]">
                  เอกสารนี้เป็นฉบับสรุป ฉบับทางการคือบันทึกผลการลงมติที่นิติบุคคลเก็บไว้
                  ขอดูได้ที่สำนักงานนิติบุคคล
                </p>
                <p className="mt-2">
                  เลขอ้างอิง <span className="font-mono text-xs">{selected.snapshotId}</span>
                </p>
                {selected.payloadSha256 ? (
                  <p className="break-all">
                    SHA-256 <span className="font-mono text-xs">{selected.payloadSha256}</span>
                  </p>
                ) : null}
                <Link
                  className="mt-2 inline-flex min-h-11 items-center font-medium text-[var(--primary)] underline"
                  href={`/verify/${selected.snapshotId}`}
                >
                  ตรวจสอบเลขอ้างอิงนี้
                </Link>
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
