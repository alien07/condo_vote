import { ChevronDown } from "lucide-react";
import { createResultPdfs } from "@/features/results/pdf/actions";
import { RESULT_PDF_FILES } from "@/features/results/pdf/files";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

const buttonClass =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]";
const primaryClass =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md bg-[var(--primary)] px-3 py-1 text-sm font-medium text-[var(--primary-foreground)]";
const menuItemClass =
  "flex min-h-11 w-full items-center px-3 py-2 text-left text-sm font-medium hover:bg-[var(--background)]";

/**
 * A result's actions (2026-11-19 review, like the meeting rows): the next
 * step is one button, the rest is under "More".
 */
export async function ResultRowActions({
  approveHref,
  approved,
  canApprove,
  hasOfficialPdf,
  locked,
  pdfCount,
  pendingManualCount,
  snapshotId,
}: {
  approveHref: string;
  approved: boolean;
  canApprove: boolean;
  hasOfficialPdf: boolean;
  /** Another result of this meeting is the one being approved. */
  locked: boolean;
  pdfCount: number;
  pendingManualCount: number;
  snapshotId: string;
}) {
  const { s } = await getStaffI18n();
  const pdfsMissing = approved && pdfCount < RESULT_PDF_FILES.length;
  const officialPdfHref = `/result-files/${snapshotId}/official-th.pdf`;
  const pdfFirst = approved && !pdfsMissing && hasOfficialPdf;

  const menu = [
    <a className={menuItemClass} href={`/record/${snapshotId}?from=results`} key="record">
      {s.results.officialRecord}
    </a>,
    approved && hasOfficialPdf && !pdfFirst ? (
      <a className={menuItemClass} href={officialPdfHref} key="pdf">
        {s.results.officialPdf}
      </a>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-2" data-result-actions>
      {pendingManualCount > 0 && !approved && !locked ? (
        <a
          className="inline-flex min-h-10 items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
          href="/admin/voting"
        >
          {fill(s.results.resolvePending, { count: pendingManualCount })}
        </a>
      ) : null}
      {canApprove ? (
        <a className={primaryClass} href={approveHref}>
          {s.results.approve}
        </a>
      ) : null}
      {pdfsMissing ? (
        <form action={createResultPdfs}>
          <input name="result_snapshot_id" type="hidden" value={snapshotId} />
          <button className={primaryClass} type="submit">
            {fill(s.results.createPdfs, { count: pdfCount, total: RESULT_PDF_FILES.length })}
          </button>
        </form>
      ) : null}
      {pdfFirst ? (
        <a className={buttonClass} href={officialPdfHref}>
          {s.results.officialPdf}
        </a>
      ) : null}
      {locked ? (
        <span className="inline-flex min-h-10 items-center text-sm text-[var(--muted)]">
          {s.results.lockedByApproved}
        </span>
      ) : null}
      <details className="group" data-more-actions>
        <summary className="tap-target inline-flex min-h-10 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {s.meetings.moreActions}
          <ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={16} />
        </summary>
        <div className="mt-1 grid min-w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm">
          {menu}
        </div>
      </details>
    </div>
  );
}
