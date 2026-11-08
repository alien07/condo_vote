import { History } from "lucide-react";
import { AuditLogTable } from "@/features/admin/components/audit-log-table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
} from "@/features/admin/components/sections/types";

type AuditLogSectionProps = Pick<
    AdminDashboardData,
    "auditLogPage"
    | "auditLogPerPage"
    | "auditLogTotal"
    | "auditLogs"
    | "auditOptions"
  > &
  Pick<AdminWorkspaceProps, "auditFilters"> & {
  hidden: boolean;
};

export function AuditLogSection({
  auditFilters,
  auditLogPage,
  auditLogPerPage,
  auditLogTotal,
  auditLogs,
  auditOptions,
  hidden,
}: AuditLogSectionProps) {
  const auditSortBy = auditFilters?.sortBy ?? "time";
  const auditSortDirection = auditFilters?.sortDirection ?? "desc";
  const auditActors = [
    ...new Map(
      auditOptions
        .map((option) => option.profiles)
        .filter((profile): profile is NonNullable<typeof profile> =>
          Boolean(profile?.id),
        )
        .map((profile) => [
          profile.id,
          {
            id: profile.id,
            label: profile.full_name ?? profile.email ?? profile.id,
          },
        ]),
    ).values(),
  ].sort((left, right) => left.label.localeCompare(right.label));
  const auditActions = [...new Set(auditOptions.map((option) => option.action))]
    .filter(Boolean)
    .sort();

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="audit"
    >
      <div className="mb-4 flex items-center gap-2">
        <History className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">Business Audit Log</h2>
      </div>
      <AuditLogTable
        actions={auditActions}
        actors={auditActors}
        initialFilters={{
          actions: auditFilters?.actions ?? [],
          actor: auditFilters?.actorProfileId ?? "",
          dir: auditSortDirection,
          from: auditFilters?.dateFrom ?? "",
          page: auditLogPage,
          perPage: auditLogPerPage,
          sort: auditSortBy,
          to: auditFilters?.dateTo ?? "",
        }}
        initialPage={auditLogPage}
        initialPerPage={auditLogPerPage}
        initialRows={auditLogs}
        initialTotal={auditLogTotal}
      />
    </section>
  );
}
