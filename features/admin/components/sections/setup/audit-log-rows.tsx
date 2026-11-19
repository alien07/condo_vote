"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { formatDateTimeIn } from "@/lib/i18n/format";
import {
  auditActionLabel,
  auditDetailPairs,
  auditEntityLabel,
  hasAuditDetails,
} from "@/features/admin/components/sections/setup/audit-log-labels";

// Audit rows in words: phone cards (md:hidden) and the table (md+), like
// Results and Email (setup review 2026-11-19). Details are "label: value"
// pairs; the stored JSON is folded under "Raw data".

export type AuditLogRow = {
  action: string;
  created_at: string;
  details_json: unknown;
  entity_id: string | null;
  entity_type: string;
  id: string;
  profiles: {
    email: string | null;
    full_name: string | null;
    id: string;
  } | null;
};

export type AuditSort = "action" | "actor" | "entity" | "time";

function Details({ log }: { log: AuditLogRow }) {
  const { locale, s } = useStaffText();
  const pairs = auditDetailPairs(s, locale, log.details_json);

  if (!hasAuditDetails(log.details_json)) {
    return <span className="text-[var(--muted)]">{s.auditLog.noDetails}</span>;
  }

  return (
    <div className="grid min-w-0 gap-1">
      {pairs.length > 0 ? (
        <dl className="grid min-w-0 gap-0.5 text-xs" data-audit-details>
          {pairs.map((pair) => (
            <div className="min-w-0 [overflow-wrap:anywhere]" key={pair.key}>
              <dt className="inline text-[var(--muted)]">{pair.label}: </dt>
              <dd className="inline" suppressHydrationWarning>
                {pair.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <details className="min-w-0 text-xs">
        <summary className="tap-target w-fit cursor-pointer text-[var(--primary)]">{s.auditLog.rawData}</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[var(--background)] p-2 [overflow-wrap:anywhere]">
          {JSON.stringify(log.details_json, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AuditLogRows({
  rows,
  sort,
  dir,
  onSort,
}: {
  rows: AuditLogRow[];
  sort: AuditSort;
  dir: "asc" | "desc";
  onSort: (sort: AuditSort) => void;
}) {
  const { locale, s } = useStaffText();
  const view = rows.map((log) => ({
    log,
    time: formatDateTimeIn(locale, log.created_at),
    actor: log.profiles?.full_name ?? log.profiles?.email ?? "-",
    action: auditActionLabel(s.auditLog, log.action),
    entity: auditEntityLabel(s.auditLog, log.entity_type),
  }));
  const columns: Array<[AuditSort, string]> = [
    ["time", s.common.time],
    ["actor", s.common.actor],
    ["action", s.common.action],
    ["entity", s.common.entity],
  ];

  return (
    <>
      <ul className="grid gap-3 p-3 md:hidden" data-audit-cards>
        {view.map((row) => (
          <li className="grid min-w-0 gap-1.5 rounded-lg border border-[var(--border)] p-3 text-sm" key={row.log.id}>
            <span className="font-medium [overflow-wrap:anywhere]">{row.action}</span>
            <span className="text-xs text-[var(--muted)]">
              <span suppressHydrationWarning>{row.time}</span> · {row.actor}
            </span>
            <span className="text-xs">
              <span className="text-[var(--muted)]">{s.common.entity}: </span>
              {row.entity}
            </span>
            <Details log={row.log} />
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-36" />
            <col className="w-[16%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col />
          </colgroup>
          <thead className="bg-[var(--background)] text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              {columns.map(([key, label]) => (
                <th className="px-3 py-2 font-medium" key={key}>
                  <button className="inline-flex min-h-11 items-center text-left font-medium" onClick={() => onSort(key)} type="button">
                    {label}
                    {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">{s.common.details}</th>
            </tr>
          </thead>
          <tbody>
            {view.map((row, index) => (
              <tr
                className={[
                  "border-b border-[var(--border)] align-top last:border-0",
                  index % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--background)]",
                ].join(" ")}
                key={row.log.id}
              >
                <td className="px-3 py-3 text-xs tabular-nums" suppressHydrationWarning>
                  {row.time}
                </td>
                <td className="px-3 py-3 [overflow-wrap:anywhere]">{row.actor}</td>
                <td className="px-3 py-3 [overflow-wrap:anywhere]">{row.action}</td>
                <td className="px-3 py-3 [overflow-wrap:anywhere]">{row.entity}</td>
                <td className="min-w-0 px-3 py-3">
                  <Details log={row.log} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
