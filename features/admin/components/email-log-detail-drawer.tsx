"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { codeLabel, fill } from "@/lib/i18n/template";
import { useEffect } from "react";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { renderEmail, templateNameFromKey } from "@/features/email/templates";
import { isLocale } from "@/lib/i18n/locales";

type EmailLog = {
  created_at: string;
  error_message: string | null;
  id: string;
  language?: string;
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
  const { s } = useStaffText();
  const templateName = templateNameFromKey(log.template_key);
  const preview = templateName
    ? renderEmail(templateName, isLocale(log.language) ? log.language : "th")
    : null;
  const detailRows = [
    [s.communications.recipient, log.recipient_email],
    [s.communications.template, log.template_key],
    [s.communications.language, log.language === "en" ? s.communications.english : s.communications.thai],
    [s.common.status, codeLabel(s.common.code, log.status)],
    [s.communications.created, createdLabel],
    [s.communications.sentAt, sentLabel],
    [s.communications.providerId, log.provider_message_id ?? "-"],
    [s.communications.error, log.error_message ?? "-"],
  ];

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[
        fill(s.communications.recipientSummary, { email: log.recipient_email }),
        fill(s.communications.statusSummary, { status: codeLabel(s.common.code, log.status) }),
      ]}
      title={s.communications.detailsTitle}
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
      {preview ? (
        <section className="mt-4 rounded-md border border-[var(--border)] p-3 text-sm">
          <h3 className="text-xs font-medium uppercase text-[var(--muted)]">
            {s.communications.preview}
          </h3>
          <p className="mt-2 font-medium" lang={log.language}>
            {preview.subject}
          </p>
          <p className="mt-2 whitespace-pre-wrap" lang={log.language}>
            {preview.body}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {s.communications.placeholders}
          </p>
        </section>
      ) : null}
    </AdminCrudDrawer>
  );
}
