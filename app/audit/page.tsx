import { ScrollText } from "lucide-react";
import { AuditLogTable } from "@/features/admin/components/audit-log-table";
import { auditFiltersFromParams } from "@/features/admin/data-modules/audit-log-params";
import { fetchAuditLogRows } from "@/features/admin/data-modules/documents";
import { auditHref } from "@/features/audit/audit-href";
import { CorrectionsTab } from "@/features/audit/corrections-tab";
import {
  AUDIT_TABS,
  auditListFilters,
  auditTabFromParam,
  fetchAuditCorrections,
  fetchAuditPublications,
  fetchAuditTabCounts,
} from "@/features/audit/data";
import { PublicationsTab } from "@/features/audit/publications-tab";
import { meetingSearchOptions } from "@/features/ui/search-options";
import { SearchSelect } from "@/features/ui/search-select";
import { requireAuditReader } from "@/lib/auth/permissions";
import { formatDateIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Read-only audit page (demo feedback item 14b). req_0007: one meeting picker
// for every tab, then tabs for published results, correction requests and
// the activity log, each with filters and paging through every row.
export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireAuditReader();

  const params = await searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, first(value)]));
  const tab = auditTabFromParam(flat.tab);
  const filters = auditListFilters(flat);
  const supabase = await createClient();
  const { locale, s } = await getStaffI18n();
  const t = s.audit;

  const [{ data: meetings, error: meetingsError }, counts] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, meeting_number, fiscal_year, starts_at")
      .order("starts_at", { ascending: false }),
    fetchAuditTabCounts(supabase, filters.meeting),
  ]);

  if (meetingsError) {
    throw meetingsError;
  }

  const meetingOptions = meetingSearchOptions(meetings ?? [], (meeting) =>
    meeting.starts_at ? formatDateIn(locale, meeting.starts_at) : undefined,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-sm sm:px-6">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <ScrollText className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.intro}</p>
        </div>
      </div>

      {/* One meeting for every tab (?meeting=<id>, rule 8). */}
      <form action="/audit" className="mb-4 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-12" data-audit-meeting>
        <input name="tab" type="hidden" value={tab} />
        <label className="grid gap-1 text-xs font-medium text-[var(--muted)] sm:col-span-8">
          {t.meeting}
          <span className="text-[var(--foreground)]">
            <SearchSelect
              defaultValue={filters.meeting}
              name="meeting"
              options={meetingOptions}
              text={{
                clear: s.common.searchClear,
                more: s.common.searchMore,
                noResults: s.common.searchNoResults,
                placeholder: s.common.allMeetings,
              }}
            />
          </span>
          <span className="font-normal">{t.meetingFilter}</span>
        </label>
        <div className="flex flex-wrap items-start gap-2 sm:col-span-4 sm:pt-5">
          <button
            className="min-h-11 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            type="submit"
          >
            {s.common.search}
          </button>
          <a
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
            href={auditHref({ tab })}
          >
            {s.common.clear}
          </a>
        </div>
      </form>

      <nav aria-label={t.tabsTitle} className="mb-5 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
        {AUDIT_TABS.map((key) => {
          const active = key === tab;

          return (
            <a
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 font-medium",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)]",
              ].join(" ")}
              data-audit-tab={key}
              href={auditHref({ tab: key, meeting: filters.meeting })}
              key={key}
            >
              {t.tabs[key]}
              <span
                aria-label={fill(t.tabCount, { count: counts[key] })}
                className={`inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs tabular-nums ${
                  active ? "bg-white/20" : "bg-[var(--background)]"
                }`}
              >
                {counts[key]}
              </span>
            </a>
          );
        })}
      </nav>

      <h2 className="sr-only">{t.tabs[tab]}</h2>
      {tab === "results" ? (
        <PublicationsTab data={await fetchAuditPublications(supabase, filters)} filters={filters} />
      ) : tab === "corrections" ? (
        <CorrectionsTab data={await fetchAuditCorrections(supabase, filters)} filters={filters} />
      ) : (
        await ActivityLogTab({ meeting: filters.meeting, params: flat, rawActions: params.actions })
      )}
    </main>
  );
}

/** The activity log: the same table, words and filters as Setup > Audit log
 * (req_0007 item 2), read through /api/audit/logs for auditors too. */
async function ActivityLogTab({
  meeting,
  params,
  rawActions,
}: {
  meeting: string;
  params: Record<string, string | undefined>;
  rawActions: string | string[] | undefined;
}) {
  const { s } = await getStaffI18n();
  const supabase = await createClient();
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "actions") query.set(key, value);
  }

  for (const action of Array.isArray(rawActions) ? rawActions : rawActions ? [rawActions] : []) {
    query.append("actions", action);
  }

  const filters = auditFiltersFromParams(query);
  const [rows, { data: options, error }] = await Promise.all([
    fetchAuditLogRows(supabase, { ...filters, meetingId: meeting || undefined }),
    // Who and what to filter by: the latest 500 rows, plus every action
    // that has words, so the action filter is complete.
    supabase
      .from("audit_logs")
      .select("action, profiles!audit_logs_actor_profile_id_fkey(id, full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (error) {
    throw error;
  }

  const actors = [
    ...new Map(
      (options ?? [])
        .map((option) => (Array.isArray(option.profiles) ? option.profiles[0] : option.profiles))
        .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile?.id))
        .map((profile) => [
          profile.id,
          {
            id: profile.id,
            label: profile.full_name ?? profile.email ?? profile.id,
            email: profile.full_name ? profile.email : null,
          },
        ]),
    ).values(),
  ].sort((left, right) => left.label.localeCompare(right.label));
  const actions = [
    ...new Set([...Object.keys(s.auditLog.actions), ...(options ?? []).map((option) => option.action)]),
  ]
    .filter(Boolean)
    .sort();

  return (
    <AuditLogTable
      actions={actions}
      actors={actors}
      baseParams={{ tab: "log", ...(meeting ? { meeting } : {}) }}
      endpoint="/api/audit/logs"
      initialFilters={{
        actions: filters.actions ?? [],
        actor: filters.actorProfileId ?? "",
        dir: filters.sortDirection ?? "desc",
        from: filters.dateFrom ?? "",
        page: rows.auditLogPage,
        perPage: rows.auditLogPerPage,
        sort: filters.sortBy ?? "time",
        to: filters.dateTo ?? "",
      }}
      initialPage={rows.auditLogPage}
      initialPerPage={rows.auditLogPerPage}
      initialRows={rows.auditLogs}
      initialTotal={rows.auditLogTotal}
    />
  );
}
