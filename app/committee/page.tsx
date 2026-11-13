import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCommitteeOverview } from "@/features/results/committee-service";
import { CloseRequestCard } from "@/features/committee/close-request-card";
import { PendingResultCard } from "@/features/committee/pending-result-card";

// Approving can start the master PDF files (D021), which needs Chromium time.
export const maxDuration = 60;

// Committee work (D014), as two steps (demo feedback item 10): closing voting
// early, which is optional and starts with a request, and approving results,
// which every result needs before it is published.
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
          <p className="text-sm text-[var(--muted)]">{t.intro}</p>
        </div>
      </div>

      <section aria-labelledby="committee-step-close" className="mb-8">
        <h2 className="text-lg font-semibold" id="committee-step-close">
          {t.stepClose}
          {overview.open_meetings.length > 0 ? ` (${overview.open_meetings.length})` : null}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.stepCloseText}</p>
        {overview.open_meetings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t.noOpen}</p>
        ) : (
          <div className="mt-3 grid gap-3">
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
      </section>

      <section aria-labelledby="committee-step-results">
        <h2 className="text-lg font-semibold" id="committee-step-results">
          {t.stepResults}
          {overview.pending_results.length > 0 ? ` (${overview.pending_results.length})` : null}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.stepResultsText}</p>
        {overview.pending_results.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t.noPending}</p>
        ) : (
          <div className="mt-3 grid gap-4">
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
      </section>
    </main>
  );
}
