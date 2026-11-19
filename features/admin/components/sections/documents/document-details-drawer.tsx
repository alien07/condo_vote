"use client";

import type { ReactNode } from "react";
import { useStaffText } from "@/lib/i18n/staff/client";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { fill } from "@/lib/i18n/template";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { CopyButton } from "@/features/admin/components/sections/documents/copy-button";
import {
  documentOwnerSummary,
  documentTypeLabel,
  formatBytes,
  storageProviderLabel,
} from "@/features/admin/components/sections/documents/document-labels";
import type { DocumentRegistryRow } from "@/features/admin/components/sections/documents/document-rows";

// "View details" (documents review 2026-11-19): the full path and checksum,
// size, type, who registered it and when. Read only.
export function DocumentDetailsDrawer({
  closeHref,
  document,
  versionHref,
}: {
  closeHref: string;
  document: DocumentRegistryRow;
  versionHref: string;
}) {
  const { locale, s } = useStaffText();
  const owner = documentOwnerSummary(s, document.owner_type, document.owner);
  const size = formatBytes(locale, document.file_size_bytes);
  const items: Array<[string, ReactNode]> = [
    [s.documents.whose, [owner.name, owner.hint].filter(Boolean).join(" · ")],
    [s.documents.documentType, documentTypeLabel(s, document.document_type)],
    [s.documents.version, String(document.document_version)],
    [s.documents.provider, storageProviderLabel(s, document.storage_provider)],
    [s.documents.path, <span className="[overflow-wrap:anywhere]" key="path">{document.storage_path}</span>],
    [s.documents.fileName, document.original_filename ?? s.documents.noValue],
    [s.documents.mime, document.mime_type ?? s.documents.noValue],
    [
      s.documents.size,
      size ? `${size} (${fill(s.documents.bytes, { size: document.file_size_bytes!.toLocaleString(locale === "th" ? "th-TH" : "en-GB") })})` : s.documents.noValue,
    ],
    [
      s.documents.checksum,
      document.checksum_sha256 ? (
        <span className="flex items-start gap-2" key="sha">
          <code className="min-w-0 text-xs [overflow-wrap:anywhere]" data-full-checksum>
            {document.checksum_sha256}
          </code>
          <CopyButton copiedLabel={s.documents.copied} label={s.documents.copyChecksum} value={document.checksum_sha256} />
        </span>
      ) : (
        s.documents.noValue
      ),
    ],
    [s.documents.registeredBy, document.uploaded_by_name ?? s.documents.noValue],
    [s.documents.registeredAt, <span key="at" suppressHydrationWarning>{formatDateTimeIn(locale, document.created_at)}</span>],
  ];

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[owner.name, documentTypeLabel(s, document.document_type)]}
      title={s.documents.details}
    >
      <dl className="grid gap-3 text-sm" data-document-details>
        {items.map(([label, value]) => (
          <div className="grid min-w-0 gap-0.5" key={label}>
            <dt className="text-xs text-[var(--muted)]">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href={versionHref}
        >
          {s.documents.registerVersion}
        </a>
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
          href={closeHref}
        >
          {s.common.close}
        </a>
      </div>
    </AdminCrudDrawer>
  );
}
