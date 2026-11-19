"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { fill } from "@/lib/i18n/template";
import { CopyButton } from "@/features/admin/components/sections/documents/copy-button";
import {
  documentOwnerSummary,
  documentTypeLabel,
  shortChecksum,
  storageProviderLabel,
  type DocumentOwnerView,
} from "@/features/admin/components/sections/documents/document-labels";

// Document rows in words: phone cards (md:hidden) and the table (md+), like
// Results and Email (documents review 2026-11-19). Both carry
// data-document-id; the focus code picks the visible one.

export type DocumentRegistryRow = {
  checksum_sha256: string | null;
  created_at: string;
  document_set_key: string;
  document_type: string;
  document_version: number;
  file_size_bytes: number | null;
  id: string;
  mime_type: string | null;
  original_filename: string | null;
  owner_id: string;
  owner_type: string;
  storage_path: string;
  storage_provider: string;
  owner: DocumentOwnerView;
  uploaded_by_name: string | null;
};

export type DocumentSort = "created" | "set" | "type";

const actionClass =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium";

function Checksum({ value }: { value: string | null }) {
  const { s } = useStaffText();
  const short = shortChecksum(value);

  if (!value || !short) {
    return <span className="text-[var(--muted)]">-</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="text-xs" title={value}>
        {short}
      </code>
      <CopyButton copiedLabel={s.documents.copied} label={s.documents.copyChecksum} value={value} />
    </span>
  );
}

export function DocumentRows({
  rows,
  focusedId,
  sort,
  dir,
  onSort,
  hrefFor,
}: {
  rows: DocumentRegistryRow[];
  focusedId?: string;
  sort: DocumentSort;
  dir: "asc" | "desc";
  onSort: (sort: DocumentSort) => void;
  hrefFor: (mode: "view" | "version", id: string) => string;
}) {
  const { locale, s } = useStaffText();
  const view = rows.map((row) => ({
    row,
    owner: documentOwnerSummary(s, row.owner_type, row.owner),
    type: documentTypeLabel(s, row.document_type),
    provider: storageProviderLabel(s, row.storage_provider),
    created: formatDateTimeIn(locale, row.created_at),
    version: fill(s.documents.versionShort, { version: row.document_version }),
    focused: row.id === focusedId,
  }));
  const focusClass = "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]";
  const actions = (id: string) => (
    <div className="flex flex-wrap gap-2">
      <a className={`${actionClass} text-[var(--primary)]`} href={hrefFor("view", id)}>
        {s.common.viewDetails}
      </a>
      <a className={actionClass} href={hrefFor("version", id)}>
        {s.documents.registerVersion}
      </a>
    </div>
  );
  const sortButton = (key: DocumentSort, label: string) => (
    <button
      className="inline-flex min-h-11 items-center whitespace-nowrap font-medium"
      onClick={() => onSort(key)}
      type="button"
    >
      {label}
      {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <>
      <ul className="grid gap-3 p-3 md:hidden" data-document-cards>
        {view.map((item) => (
          <li
            className={["grid min-w-0 gap-1.5 rounded-lg border border-[var(--border)] p-3 text-sm", item.focused ? focusClass : ""].join(" ")}
            data-document-id={item.row.id}
            key={item.row.id}
            tabIndex={-1}
          >
            <span className="font-medium [overflow-wrap:anywhere]">{item.owner.name}</span>
            {item.owner.hint ? <span className="text-xs text-[var(--muted)]">{item.owner.hint}</span> : null}
            <span>
              {item.type} · {item.version}
            </span>
            <span className="text-xs text-[var(--muted)]" suppressHydrationWarning>
              {item.created}
            </span>
            <span className="min-w-0 text-xs [overflow-wrap:anywhere]">
              {item.provider}: {item.row.storage_path}
            </span>
            <Checksum value={item.row.checksum_sha256} />
            {actions(item.row.id)}
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-[var(--background)] text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-2 font-medium">{s.documents.whose}</th>
              <th className="px-3 py-2 font-medium">{sortButton("type", s.documents.type)}</th>
              <th className="px-3 py-2 font-medium">{s.documents.where}</th>
              <th className="px-3 py-2 font-medium">{sortButton("created", s.documents.created)}</th>
              <th className="px-3 py-2 font-medium">{s.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {view.map((item, index) => (
              <tr
                className={[
                  "border-b border-[var(--border)] align-top last:border-0",
                  item.focused ? focusClass : index % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--background)]",
                ].join(" ")}
                data-document-id={item.row.id}
                key={item.row.id}
                tabIndex={-1}
              >
                <td className="px-3 py-3">
                  <div className="font-medium [overflow-wrap:anywhere]">{item.owner.name}</div>
                  {item.owner.hint ? <div className="text-xs text-[var(--muted)]">{item.owner.hint}</div> : null}
                </td>
                <td className="px-3 py-3">
                  <div>{item.type}</div>
                  <div className="text-xs text-[var(--muted)]">{item.version}</div>
                </td>
                <td className="px-3 py-3">
                  <div>{item.provider}</div>
                  <div className="truncate text-xs text-[var(--muted)]" title={item.row.storage_path}>
                    {item.row.storage_path}
                  </div>
                  <div className="mt-1">
                    <Checksum value={item.row.checksum_sha256} />
                  </div>
                </td>
                <td className="px-3 py-3 text-xs" suppressHydrationWarning>
                  {item.created}
                </td>
                <td className="px-3 py-3">{actions(item.row.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
