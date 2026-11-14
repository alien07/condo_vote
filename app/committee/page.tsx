import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCommitteeOverview } from "@/features/results/committee-service";
import { CloseRequestCard } from "@/features/committee/close-request-card";
import { PendingResultCard } from "@/features/committee/pending-result-card";
import { fill } from "@/lib/i18n/template";

// Approving can start the master PDF files (D021), which needs Chromium time.
export const maxDuration = 60;

// Committee work (D014), in two panels (demo feedback item 10, review
// 2026-11-14): approving results, which every result needs before it is
// published, comes first; closing voting early is optional and starts with
// a request.
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
  const pendingCount = overview.pending_results.length;
  const openCount = overview.open_meetings.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <Gavel className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">{t.intro}</p>
        </div>
      </div>

      {/* Summary with jump links; on a phone the page gets long. */}
      <nav aria-label={t.jumpTo} className="mb-6 flex flex-wrap gap-2 text-sm" data-committee-summary>
        <a
          className={`inline-flex min-h-11 items-center rounded-full px-4 font-medium ${
            pendingCount > 0
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "border border-[var(--border)] bg-[var(--surface)]"
          }`}
          href="#committee-step-results"
        >
          {fill(t.pendingCount, { count: pendingCount })}
        </a>
        <a
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 font-medium"
          href="#committee-step-close"
        >
          {fill(t.openCount, { count: openCount })}
        </a>
      </nav>

      {/* 1. Approve results: required work, so it comes first and stands out. */}
      <section
        aria-labelledby="committee-step-results"
        className="mb-8 scroll-mt-4 overflow-hidden rounded-lg border-2 border-[var(--primary)] bg-[var(--surface)]"
      >
        <div className="border-b border-[var(--border)] bg-[var(--primary)]/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold" id="committee-step-results">
              {t.stepResults}
            </h2>
            <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-[var(--primary-foreground)]">
              {t.required}
            </span>
            <span className="text-sm text-[var(--muted)]">{fill(t.pendingCount, { count: pendingCount })}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.stepResultsText}</p>
        </div>
        <div className="p-4">
          {pendingCount === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.noPending}</p>
          ) : (
            <div className="grid gap-4">
              {overview.pending_results.map((result) => (
                <PendingResultCard
                  formatDateTime={formatDateTime}
                  key={result.snapshot_id}
                  locale={locale}
                  members={overview.members}
                  result={result}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. Close voting early: optional, so it is quieter. */}
      <section
        aria-labelledby="committee-step-close"
        className="scroll-mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold" id="committee-step-close">
              {t.stepClose}
            </h2>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
              {t.optional}
            </span>
            <span className="text-sm text-[var(--muted)]">{fill(t.openCount, { count: openCount })}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.stepCloseText}</p>
        </div>
        <div className="p-4">
          {openCount === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.noOpen}</p>
          ) : (
            <div className="grid gap-3">
              {overview.open_meetings.map((meeting) => (
                <CloseRequestCard
                  formatDateTime={formatDateTime}
                  isMember={overview.is_member}
                  key={meeting.id}
                  locale={locale}
                  meeting={meeting}
                  members={overview.members}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
