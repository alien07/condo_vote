import { ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/auth/permissions";
import { formatThaiDateTime } from "@/lib/datetime";
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
  const supabase = await createClient();
  const [snapshotResult, publicationResult] = UUID.test(snapshotId)
    ? await Promise.all([
        supabase
          .from("result_snapshots")
          .select("id, generated_at, payload_sha256, meetings(title)")
          .eq("id", snapshotId)
          .maybeSingle(),
        supabase
          .from("result_publications")
          .select("published_at, approvals_count")
          .eq("result_snapshot_id", snapshotId)
          .maybeSingle(),
      ])
    : [null, null];
  const snapshot = snapshotResult?.data ?? null;
  const publication = publicationResult?.data ?? null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 text-sm">
      <div className="mb-6 flex items-start gap-3">
        <ShieldCheck className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">ตรวจสอบเอกสารผลการลงมติ</h1>
          <p className="text-[var(--muted)]">
            เลขอ้างอิง <span className="font-mono text-xs">{snapshotId}</span>
          </p>
        </div>
      </div>

      {snapshot && publication ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-base font-semibold text-emerald-900">
            พบผลการลงมติที่เผยแพร่แล้ว
          </h2>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-[var(--muted)]">การประชุม</dt>
              <dd className="font-medium">{snapshot.meetings?.title ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">เผยแพร่ผลเมื่อ</dt>
              <dd>
                {formatThaiDateTime(publication.published_at)} (อนุมัติ {publication.approvals_count} คน)
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">SHA-256</dt>
              <dd className="break-all font-mono text-xs">{snapshot.payload_sha256 ?? "-"}</dd>
            </div>
          </dl>
          <p className="mt-3">
            เทียบค่า SHA-256 กับที่พิมพ์ในเอกสาร ถ้าตรงกัน เอกสารอ้างถึงผลชุดเดียวกับที่ระบบเก็บไว้
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-red-900">ไม่พบผลการลงมติที่เผยแพร่แล้ว</h2>
          <p className="mt-2">
            เลขอ้างอิงนี้ไม่ตรงกับผลที่เผยแพร่ หรือผลยังไม่ได้รับการอนุมัติครบ
            โปรดตรวจเลขอ้างอิงอีกครั้ง หรือติดต่อสำนักงานนิติบุคคล
          </p>
        </section>
      )}
    </main>
  );
}
