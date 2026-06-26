"use client";

import { useEffect } from "react";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";

type EmailLog = {
  created_at: string;
  error_message: string | null;
  id: string;
  provider_message_id?: string | null;
  recipient_email: string;
  sent_at: string | null;
  status: string;
  template_key: string;
};

type EmailLogDetailDrawerProps = {
  closeHref: string;
  createdLabel: string;
  log: EmailLog;
  sentLabel: string;
};

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function EmailLogRowFocus({ logId }: { logId?: string | null }) {
  useEffect(() => {
    if (!logId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-email-log-id="${escapeSelectorValue(logId)}"]`,
      );

      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [logId]);

  return null;
}

export function EmailLogDetailDrawer({
  closeHref,
  createdLabel,
  log,
  sentLabel,
}: EmailLogDetailDrawerProps) {
  const detailRows = [
    ["Recipient", log.recipient_email],
    ["Template", log.template_key],
    ["Status", log.status],
    ["Created", createdLabel],
    ["Sent", sentLabel],
    ["Provider message ID", log.provider_message_id ?? "-"],
    ["Error", log.error_message ?? "-"],
  ];

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[`Recipient: ${log.recipient_email}`, `Status: ${log.status}`]}
      title="Email log details"
    >
      <dl className="grid gap-3 text-sm">
        {detailRows.map(([label, value]) => (
          <div
            className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
            key={label}
          >
            <dt className="text-xs font-medium uppercase text-[var(--muted)]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-[var(--foreground)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AdminCrudDrawer>
  );
}
