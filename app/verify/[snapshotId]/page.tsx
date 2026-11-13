import { ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/auth/permissions";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type VerifyPageProps = {
  params: Promise<{ snapshotId: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checks a result document's reference: shows whether the result is
// published and its SHA-256, so a printed or forwarded copy can be compared.
export default async function VerifyPage({ params }: VerifyPageProps) {
  await requireProfile();
  const { snapshotId } = await params;
  const { locale, t: dict } = await getI18n();
  const t = dict.verify;
  const supabase = await createClient();
  // Hash and publication only, through verify_result_reference() (0029), so
  // the check works for every signed-in account without exposing results.
  const { data } = UUID.test(snapshotId)
    ? await supabase.rpc("verify_result_reference", { p_snapshot_id: snapshotId })
    : { data: null };
  const reference = (data ?? null) as unknown as {
    meeting_title: string | null;
    payload_sha256: string | null;
    published_at: string;
    approvals_count: number;
  } | null;
  const snapshot = reference
    ? { meetings: { title: reference.meeting_title }, payload_sha256: reference.payload_sha256 }
    : null;
  const publication = reference
    ? { published_at: reference.published_at, approvals_count: reference.approvals_count }
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 text-sm" lang={locale}>
      <div className="mb-6 flex items-start gap-3">
        <ShieldCheck className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-[var(--muted)]">
            {t.reference} <span className="font-mono text-xs">{snapshotId}</span>
          </p>
        </div>
      </div>

      {snapshot && publication ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-base font-semibold text-emerald-900">
            {t.foundTitle}
          </h2>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-[var(--muted)]">{t.meeting}</dt>
              <dd className="font-medium">{snapshot.meetings?.title ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">{t.publishedAt}</dt>
              <dd>
                {formatDateTimeIn(locale, publication.published_at)} (
                {t.approvals(publication.approvals_count)})
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">SHA-256</dt>
              <dd className="break-all font-mono text-xs">{snapshot.payload_sha256 ?? "-"}</dd>
            </div>
          </dl>
          <p className="mt-3">
            {t.foundText}
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-red-900">{t.notFoundTitle}</h2>
          <p className="mt-2">
            {t.notFoundText}
          </p>
        </section>
      )}
    </main>
  );
}
