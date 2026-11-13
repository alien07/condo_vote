import { Clock } from "lucide-react";

/** Tells a signed-in user whose account is not approved what happens next. */
export function ApprovalNotice({
  status,
  text,
}: {
  status: string | null | undefined;
  text: { pending: string; rejected: string };
}) {
  if (status !== "pending" && status !== "rejected") {
    return null;
  }

  return (
    <p
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      data-approval-status={status}
      role="status"
    >
      <Clock aria-hidden className="mt-0.5 shrink-0" size={16} />
      <span>{status === "pending" ? text.pending : text.rejected}</span>
    </p>
  );
}
