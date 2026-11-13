import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Read-only audit page (demo feedback item 14b): published results with their
// official records, correction requests, and the latest audit log entries.
export default async function AuditPage() {
  const { roles } = await requireProfileWithRoles();

  if (!roles.includes("auditor") && !roles.includes("admin")) {
    redirect(DENIED_PATH);
  }

  const supabase = await createClient();
  const { locale, s } = await getStaffI18n();
  const t = s.audit;
  const formatDateTime = (value: string) => formatDateTimeIn(locale, value);
  const [publications, corrections, logs] = await Promise.all([
    supabase
      .from("result_publications")
      .select("id, published_at, approvals_count, result_snapshot_id, meetings(title)")
      .order("published_at", { ascending: false }),
    supabase
      .from("result_correction_requests")
      .select("id, category, level, status, reason, created_at, meetings(title)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  for (const result of [publications, corrections, logs]) {
    if (result.error) {
      throw result.error;
    }
  }

  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-sm">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <ScrollText className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.intro}</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold">{t.results}</h2>
        {publications.data?.length ? (
          <ul className="mt-3 grid gap-2">
            {publications.data.map((publication) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                key={publication.id}
              >
                <span className="font-medium">{one(publication.meetings)?.title ?? "-"}</span>
                <span className="text-[var(--muted)]">
                  {formatDateTime(publication.published_at)} · {publication.approvals_count}
                </span>
                <Link
                  className="font-medium text-[var(--primary)] underline"
                  href={`/record/${publication.result_snapshot_id}`}
                >
                  {t.officialRecord}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--muted)]">{t.none}</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold">{t.corrections}</h2>
        {corrections.data?.length ? (
          <ul className="mt-3 grid gap-2">
            {corrections.data.map((correction) => (
              <li className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3" key={correction.id}>
                <div className="font-medium">{one(correction.meetings)?.title ?? "-"}</div>
                <div className="text-[var(--muted)]">
                  {formatDateTime(correction.created_at)} · {s.committee.categories[correction.category] ?? correction.category} ·{" "}
                  {s.committee.levels[correction.level] ?? correction.level} ·{" "}
                  {s.committee.correctionStatus[correction.status] ?? correction.status}
                </div>
                <div>{correction.reason}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--muted)]">{t.none}</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.log}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">{t.time}</th>
                <th className="py-2 pr-3 font-medium">{t.actor}</th>
                <th className="py-2 pr-3 font-medium">{t.action}</th>
                <th className="py-2 font-medium">{t.entity}</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map((log) => (
                <tr className="border-b border-[var(--border)]" key={log.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="py-2 pr-3">{one(log.profiles)?.full_name ?? "-"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{log.action}</td>
                  <td className="py-2">{log.entity_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
