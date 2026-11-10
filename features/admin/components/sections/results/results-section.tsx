import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { ListChecks } from "lucide-react";
import { createResultPdfs } from "@/features/results/pdf/actions";
import { RESULT_PDF_FILES } from "@/features/results/pdf/files";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { ResultApprovalDrawer, ResultSnapshotRowFocus } from "@/features/admin/components/result-approval-drawer";
import { resultHref } from "@/features/admin/components/sections/results/result-hrefs";
import { formatDateTime, formatPercent, getResultTotals } from "@/features/admin/components/sections/shared/format";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  ResultTableFilters,
} from "@/features/admin/components/sections/types";
import type {
  SharedAdminState,
} from "@/features/admin/components/sections/shared/derived";

type ResultsSectionProps = Pick<
    AdminDashboardData,
    "resultSnapshots"
  > &
  Pick<
    SharedAdminState,
    "approvalCountBySnapshotId"
    | "approvedMeetingIds"
    | "approvedResultSnapshotIds"
    | "lockedMeetingIds"
    | "pendingManualBallotsByMeetingId"
  > &
  Pick<
    AdminWorkspaceProps,
    "drawer"
    | "focusedResultSnapshotId"
    | "resultFilters"
  > & {
  hidden: boolean;
};

export async function ResultsSection({
  approvalCountBySnapshotId,
  approvedMeetingIds,
  approvedResultSnapshotIds,
  lockedMeetingIds,
  drawer,
  focusedResultSnapshotId,
  pendingManualBallotsByMeetingId,
  resultFilters,
  resultSnapshots,
  hidden,
}: ResultsSectionProps) {
  const { s } = await getStaffI18n();
  const resultTableFilters: Required<ResultTableFilters> = {
    approval: resultFilters?.approval ?? "all",
    dir: resultFilters?.dir ?? "asc",
    generated: resultFilters?.generated ?? "",
    meeting: resultFilters?.meeting ?? "",
    page: tablePage(resultFilters?.page),
    perPage: tablePerPage(resultFilters?.perPage),
    sort: resultFilters?.sort ?? "meeting",
  };
  const filteredResultSnapshots = resultSnapshots.filter((snapshot) => {
    const meetingQuery = resultTableFilters.meeting.trim().toLowerCase();
    const generatedQuery = resultTableFilters.generated.trim();
    const approvalStatus = approvedResultSnapshotIds.has(snapshot.id)
      ? "approved"
      : "pending";
    const matchesMeeting = meetingQuery
      ? (snapshot.meetings?.title ?? "").toLowerCase().includes(meetingQuery)
      : true;
    const matchesGenerated = generatedQuery
      ? snapshot.generated_at.slice(0, 10) === generatedQuery
      : true;
    const matchesApproval =
      resultTableFilters.approval === "all"
        ? true
        : approvalStatus === resultTableFilters.approval;

    return matchesMeeting && matchesGenerated && matchesApproval;
  });
  const sortedResultSnapshots = [...filteredResultSnapshots].sort((left, right) => {
    const direction = resultTableFilters.dir === "asc" ? 1 : -1;
    const leftApproval = approvedResultSnapshotIds.has(left.id)
      ? "approved"
      : "pending";
    const rightApproval = approvedResultSnapshotIds.has(right.id)
      ? "approved"
      : "pending";
    const leftValue =
      resultTableFilters.sort === "approval"
        ? leftApproval
        : resultTableFilters.sort === "generated"
          ? left.generated_at
          : left.meetings?.title ?? "";
    const rightValue =
      resultTableFilters.sort === "approval"
        ? rightApproval
        : resultTableFilters.sort === "generated"
          ? right.generated_at
          : right.meetings?.title ?? "";

    return leftValue.localeCompare(rightValue) * direction;
  });
  const resultTotal = sortedResultSnapshots.length;
  const resultTotalPages = Math.max(
    1,
    Math.ceil(resultTotal / resultTableFilters.perPage),
  );
  const resultPage = Math.min(resultTableFilters.page, resultTotalPages);
  const resultPageStart =
    resultTotal === 0 ? 0 : (resultPage - 1) * resultTableFilters.perPage + 1;
  const resultPageEnd = Math.min(
    resultPage * resultTableFilters.perPage,
    resultTotal,
  );
  const pagedResultSnapshots = sortedResultSnapshots.slice(
    (resultPage - 1) * resultTableFilters.perPage,
    resultPage * resultTableFilters.perPage,
  );
  const resultListHref = resultHref({
    ...resultTableFilters,
    page: resultPage,
  });
  const resultPageUrls = Object.fromEntries(
    Array.from({ length: resultTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        resultHref({ ...resultTableFilters, page: pageNumber }),
      ],
    ),
  );
  const resultPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      resultHref({ ...resultTableFilters, page: 1, perPage }),
    ]),
  );
  const resultSortHref = (sort: Required<ResultTableFilters>["sort"]) =>
    resultHref({
      ...resultTableFilters,
      dir:
        resultTableFilters.sort === sort && resultTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const resultSortLabel = (sort: Required<ResultTableFilters>["sort"]) =>
    resultTableFilters.sort === sort
      ? resultTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="results"
    >
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">{s.results.title}</h2>
      </div>
      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.results.filter}
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input name="sort" type="hidden" value={resultTableFilters.sort} />
          <input name="dir" type="hidden" value={resultTableFilters.dir} />
          <input
            name="perPage"
            type="hidden"
            value={resultTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            {s.results.meeting}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={resultTableFilters.meeting}
              name="meeting"
              placeholder={s.results.searchMeeting}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.results.generated}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={resultTableFilters.generated}
              name="generated"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.results.approval}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={resultTableFilters.approval}
              name="approval"
            >
              <option value="all">{s.results.allApprovals}</option>
              <option value="approved">{s.results.approvedOption}</option>
              <option value="pending">{s.results.pendingOption}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-2">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              {s.common.search}
            </button>
            <a
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              href="/admin/results"
            >
              {s.common.clear}
            </a>
          </div>
        </form>
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{s.results.title}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {fill(s.common.showing, { start: resultPageStart, end: resultPageEnd, total: resultTotal })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label={s.common.page}
            options={Array.from(
              { length: resultTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={resultPageUrls}
            value={resultPage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            {fill(s.common.ofPages, { total: resultTotalPages })}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label={s.common.perPage}
            urlByValue={resultPerPageUrls}
            value={resultTableFilters.perPage}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <a href={resultSortHref("meeting")}>
                  {s.results.meeting}{resultSortLabel("meeting")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={resultSortHref("generated")}>
                  {s.results.generated}{resultSortLabel("generated")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">{s.results.submitted}</th>
              <th className="py-2 pr-3 font-medium">{s.results.ownership}</th>
              <th className="py-2 pr-3 font-medium">
                <a href={resultSortHref("approval")}>
                  {s.results.approval}{resultSortLabel("approval")}
                </a>
              </th>
              <th className="py-2 font-medium">{s.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {pagedResultSnapshots.map((snapshot) => {
              const totals = getResultTotals(snapshot.payload_json);
              const approved = approvedResultSnapshotIds.has(snapshot.id);
              // Master PDF files (D021) are made in the background after
              // publication; the button makes any that are missing.
              const pdfFiles = snapshot.result_documents ?? [];
              const pdfCount = pdfFiles.length;
              const hasOfficialPdf = pdfFiles.some((file) => file.kind === "official");
              const meetingApproved = approvedMeetingIds.has(
                snapshot.meeting_id,
              );
              const approvalCount = approvalCountBySnapshotId.get(snapshot.id) ?? 0;
              const requiredApprovals = snapshot.meetings?.required_approvals ?? 1;
              // Another snapshot of this meeting already collects approvals.
              const lockedByOther =
                lockedMeetingIds.has(snapshot.meeting_id) && approvalCount === 0;
              const pendingManualCount =
                pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                  ?.length ?? 0;
              const selected =
                drawer?.mode === "edit" &&
                drawer.type === "result_approval" &&
                drawer.id === snapshot.id;
              const focused = focusedResultSnapshotId === snapshot.id;

              return (
                <tr
                  className={[
                    "border-b border-[var(--border)]",
                    selected || focused
                      ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                      : "",
                  ].join(" ")}
                  data-result-snapshot-id={snapshot.id}
                  key={snapshot.id}
                  tabIndex={-1}
                >
                  <td className="py-2 pr-3">
                    {snapshot.meetings?.title ?? "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {formatDateTime(snapshot.generated_at)}
                  </td>
                  <td className="py-2 pr-3">
                    {totals?.submitted_ballots ?? 0} /{" "}
                    {totals?.eligible_voters ?? 0}
                  </td>
                  <td className="py-2 pr-3">
                    {formatPercent(totals?.submitted_ownership)} /{" "}
                    {formatPercent(totals?.total_eligible_ownership)}
                  </td>
                  <td className="py-2 pr-3">
                    {approved
                      ? s.results.approved
                      : fill(s.results.pending, { count: approvalCount, required: requiredApprovals })}
                  </td>
                  <td className="py-2">
                    {!meetingApproved && !lockedByOther && pendingManualCount === 0 ? (
                      <a
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                        href={`${resultListHref}&mode=edit&type=result_approval&id=${snapshot.id}`}
                      >
                        {s.results.approve}
                      </a>
                    ) : null}
                    {!meetingApproved && pendingManualCount > 0 ? (
                      <a
                        className="text-sm font-medium text-amber-700"
                        href="/admin/voting"
                      >
                        {fill(s.results.resolvePending, { count: pendingManualCount })}
                      </a>
                    ) : null}
                    {(meetingApproved && !approved) || lockedByOther ? (
                      <span className="text-sm text-[var(--muted)]">
                        {s.results.lockedByApproved}
                      </span>
                    ) : null}
                    <a
                      className="ml-2 inline-flex min-h-9 items-center text-sm font-medium text-[var(--primary)] underline"
                      href={`/record/${snapshot.id}`}
                    >
                      {s.results.officialRecord}
                    </a>
                    {approved && hasOfficialPdf ? (
                      <a
                        className="ml-2 inline-flex min-h-9 items-center text-sm font-medium text-[var(--primary)] underline"
                        href={`/result-files/${snapshot.id}/official-th.pdf`}
                      >
                        {s.results.officialPdf}
                      </a>
                    ) : null}
                    {approved && pdfCount < RESULT_PDF_FILES.length ? (
                      <form action={createResultPdfs} className="ml-2 inline">
                        <input name="result_snapshot_id" type="hidden" value={snapshot.id} />
                        <button
                          className="inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm font-medium"
                          type="submit"
                        >
                          {fill(s.results.createPdfs, { count: pdfCount, total: RESULT_PDF_FILES.length })}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagedResultSnapshots.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {s.results.noResults}
        </p>
      ) : null}
      <ResultSnapshotRowFocus snapshotId={focusedResultSnapshotId} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={resultPage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            resultPage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={resultHref({
            ...resultTableFilters,
            page: Math.max(1, resultPage - 1),
          })}
        >
          {s.common.previous}
        </a>
        <div className="text-sm text-[var(--muted)]">
          {resultPageStart}-{resultPageEnd} / {resultTotal}
        </div>
        <a
          aria-disabled={resultPage >= resultTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            resultPage >= resultTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={resultHref({
            ...resultTableFilters,
            page: Math.min(resultTotalPages, resultPage + 1),
          })}
        >
          {s.common.next}
        </a>
      </div>
      {drawer?.mode === "edit" && drawer.type === "result_approval"
        ? resultSnapshots
            .filter((snapshot) => snapshot.id === drawer.id)
            .map((snapshot) => (
              <ResultApprovalDrawer
                closeHref={resultListHref}
                generatedLabel={formatDateTime(snapshot.generated_at)}
                key={snapshot.id}
                pendingManualCount={
                  pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                    ?.length ?? 0
                }
                snapshot={snapshot}
              />
            ))
        : null}
    </section>
  );
}
