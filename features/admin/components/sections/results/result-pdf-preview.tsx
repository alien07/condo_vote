import { FileText } from "lucide-react";
import { formatDateTime, formatPercent, getResultPayload } from "@/features/admin/components/sections/shared/format";
import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";
import type {
  SharedAdminState,
} from "@/features/admin/components/sections/shared/derived";

type ResultPdfPreviewProps = Pick<
    AdminDashboardData,
    "committeeMembers"
    | "condoProfile"
    | "resultSnapshots"
  > &
  Pick<
    SharedAdminState,
    "approvalBySnapshotId"
    | "approvedResultSnapshotIds"
  >;

export function ResultPdfPreview({
  approvalBySnapshotId,
  approvedResultSnapshotIds,
  committeeMembers,
  condoProfile,
  resultSnapshots,
}: ResultPdfPreviewProps) {
  const pdfPreviewSnapshot =
    resultSnapshots.find((snapshot) => approvedResultSnapshotIds.has(snapshot.id)) ??
    resultSnapshots[0] ??
    null;
  const pdfPreviewPayload = pdfPreviewSnapshot
    ? getResultPayload(pdfPreviewSnapshot.payload_json)
    : null;
  const pdfPreviewApproval = pdfPreviewSnapshot
    ? approvalBySnapshotId.get(pdfPreviewSnapshot.id)
    : null;

  if (!(pdfPreviewSnapshot && pdfPreviewPayload)) {
    return null;
  }

  return (
    <div
className="mt-6 border-t border-[var(--border)] pt-5"
id="mock-pdf-summary"
>
<div className="mb-4 flex items-center gap-2">
  <FileText className="text-[var(--primary)]" size={20} />
  <div>
    <h3 className="text-base font-semibold">
      Mock PDF Result Summary
    </h3>
    <p className="text-sm text-[var(--muted)]">
      Print-ready preview for juristic person review. Production
      PDF generation remains a Tail V1 task.
    </p>
  </div>
</div>
<article className="bg-white p-6 text-sm leading-6 shadow-sm ring-1 ring-[var(--border)]">
  <header className="border-b border-[var(--border)] pb-4 text-center">
    <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
      Condominium juristic person result summary
    </div>
    <h4 className="mt-2 text-xl font-semibold">
      {condoProfile?.juristic_name ??
        condoProfile?.project_name ??
        "Condominium Juristic Person"}
    </h4>
    <p className="text-[var(--muted)]">
      {condoProfile?.project_name ?? "-"}
    </p>
  </header>

  <dl className="mt-4 grid gap-3 md:grid-cols-2">
    <div>
      <dt className="font-medium">Meeting</dt>
      <dd>
        {pdfPreviewPayload.meeting?.title ??
          pdfPreviewSnapshot.meetings?.title ??
          "-"}
      </dd>
    </div>
    <div>
      <dt className="font-medium">Meeting no. / fiscal year</dt>
      <dd>
        {pdfPreviewPayload.meeting?.meeting_number ?? "-"} /{" "}
        {pdfPreviewPayload.meeting?.fiscal_year ?? "-"}
      </dd>
    </div>
    <div>
      <dt className="font-medium">Meeting date</dt>
      <dd>
        {pdfPreviewPayload.meeting?.starts_at
          ? formatDateTime(pdfPreviewPayload.meeting.starts_at)
          : "-"}
      </dd>
    </div>
    <div>
      <dt className="font-medium">Location</dt>
      <dd>{pdfPreviewPayload.meeting?.location ?? "-"}</dd>
    </div>
    <div>
      <dt className="font-medium">Registration / tax ID</dt>
      <dd>
        {condoProfile?.registration_no ?? "-"} /{" "}
        {condoProfile?.tax_id ?? "-"}
      </dd>
    </div>
    <div>
      <dt className="font-medium">Chairperson</dt>
      <dd>{pdfPreviewPayload.meeting?.chairperson_name ?? "-"}</dd>
    </div>
  </dl>

  <section className="mt-5">
    <h5 className="font-semibold">Voting Totals</h5>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <tbody>
          <tr className="border-b border-[var(--border)]">
            <th className="py-2 pr-3 font-medium">
              Eligible voters
            </th>
            <td className="py-2">
              {pdfPreviewPayload.totals?.eligible_voters ?? 0}
            </td>
          </tr>
          <tr className="border-b border-[var(--border)]">
            <th className="py-2 pr-3 font-medium">
              Submitted ballots
            </th>
            <td className="py-2">
              {pdfPreviewPayload.totals?.submitted_ballots ?? 0}
            </td>
          </tr>
          <tr className="border-b border-[var(--border)]">
            <th className="py-2 pr-3 font-medium">
              Online / manual ballots
            </th>
            <td className="py-2">
              {pdfPreviewPayload.totals?.online_ballots ?? 0} /{" "}
              {pdfPreviewPayload.totals?.manual_ballots ?? 0}
            </td>
          </tr>
          <tr>
            <th className="py-2 pr-3 font-medium">
              Submitted / eligible ownership
            </th>
            <td className="py-2">
              {formatPercent(
                pdfPreviewPayload.totals?.submitted_ownership,
              )}{" "}
              /{" "}
              {formatPercent(
                pdfPreviewPayload.totals
                  ?.total_eligible_ownership,
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section className="mt-5">
    <h5 className="font-semibold">Agenda Results</h5>
    <div className="mt-2 space-y-4">
      {pdfPreviewPayload.questions?.map((question, index) => (
        <div
          className="border-b border-[var(--border)] pb-3 last:border-0"
          key={`${question.agenda_no ?? index}-${question.text}`}
        >
          <div className="font-medium">
            {question.agenda_no ?? `Item ${index + 1}`}{" "}
            {question.agenda_title ?? question.text ?? "-"}
          </div>
          <div className="text-[var(--muted)]">
            Resolution: {question.resolution_type ?? "-"}
            {question.required_threshold
              ? `, threshold ${formatPercent(
                  question.required_threshold,
                )}`
              : ""}
            {question.requires_land_office_registration
              ? ", land office registration required"
              : ""}
          </div>
          <table className="mt-2 w-full border-collapse text-left">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="py-1 pr-3 font-medium">Choice</th>
                <th className="py-1 pr-3 font-medium">Rooms</th>
                <th className="py-1 pr-3 font-medium">
                  Ownership
                </th>
                <th className="py-1 font-medium">
                  Submitted %
                </th>
              </tr>
            </thead>
            <tbody>
              {question.choices?.map((choice) => (
                <tr
                  className="border-b border-[var(--border)] last:border-0"
                  key={choice.text}
                >
                  <td className="py-1 pr-3">
                    {choice.text ?? "-"}
                  </td>
                  <td className="py-1 pr-3">
                    {choice.vote_count ?? 0}
                  </td>
                  <td className="py-1 pr-3">
                    {formatPercent(choice.ownership)}
                  </td>
                  <td className="py-1">
                    {formatPercent(
                      choice.percent_of_submitted_ownership,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {question.legal_note ? (
            <p className="mt-2 text-[var(--muted)]">
              Legal note: {question.legal_note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  </section>

  <section className="mt-5">
    <h5 className="font-semibold">Conflict And Audit Notes</h5>
    <p>
      Source conflicts:{" "}
      {pdfPreviewPayload.totals?.source_conflicts ?? 0}; resolved:{" "}
      {pdfPreviewPayload.totals?.resolved_source_conflicts ?? 0}.
    </p>
    {pdfPreviewPayload.vote_source_audit?.conflicts?.length ? (
      <ul className="mt-2 list-disc pl-5">
        {pdfPreviewPayload.vote_source_audit.conflicts.map(
          (conflict, index) => (
            <li key={`${conflict.chosen_source}-${index}`}>
              Source: {conflict.chosen_source ?? "-"}; remark:{" "}
              {conflict.conflict_remark ?? "-"}
            </li>
          ),
        )}
      </ul>
    ) : (
      <p className="text-[var(--muted)]">
        No manual/online source conflict recorded for this
        snapshot.
      </p>
    )}
  </section>

  <section className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-2">
    <div>
      <h5 className="font-semibold">Committee / approver</h5>
      <p>
        {pdfPreviewApproval?.profiles?.full_name ??
          pdfPreviewPayload.meeting?.chairperson_name ??
          "-"}
      </p>
      <p className="text-[var(--muted)]">
        Approved:{" "}
        {pdfPreviewApproval?.approved_at
          ? formatDateTime(pdfPreviewApproval.approved_at)
          : "Pending"}
      </p>
      <p className="text-[var(--muted)]">
        Notes: {pdfPreviewApproval?.notes ?? "-"}
      </p>
    </div>
    <div>
      <h5 className="font-semibold">Committee members</h5>
      <p>
        {committeeMembers
          .filter((member) => member.active)
          .map((member) => member.full_name)
          .join(", ") || "-"}
      </p>
    </div>
  </section>

  <footer className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
    Generated:{" "}
    {pdfPreviewPayload.generated_at
      ? formatDateTime(pdfPreviewPayload.generated_at)
      : formatDateTime(pdfPreviewSnapshot.generated_at)}
    {condoProfile?.document_footer
      ? ` | ${condoProfile.document_footer}`
      : ""}
  </footer>
</article>
</div>
  );
}
