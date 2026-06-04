import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { AuditLogFilters } from "@/features/admin/data-modules/documents";

type AdminSetupPageProps = {
  searchParams: Promise<{
    actions?: string | string[];
    actor?: string;
    dir?: string;
    from?: string;
    sort?: string;
    tab?: string;
    to?: string;
  }>;
};

function getActions(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value?.split(",").filter(Boolean) ?? [];
}

function getAuditFilters(
  params: Awaited<AdminSetupPageProps["searchParams"]>,
): AuditLogFilters {
  const sortBy =
    params.sort === "actor" ||
    params.sort === "action" ||
    params.sort === "entity" ||
    params.sort === "time"
      ? params.sort
      : "time";

  return {
    actions: getActions(params.actions),
    actorProfileId: params.actor,
    dateFrom: params.from,
    dateTo: params.to,
    sortBy,
    sortDirection: params.dir === "asc" ? "asc" : "desc",
  };
}

export default async function AdminSetupPage({
  searchParams,
}: AdminSetupPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      activeSection={params.tab}
      auditFilters={params.tab === "audit" ? getAuditFilters(params) : undefined}
      description="Juristic profile and committee setup for formal meeting documents."
      sections={["setup", "storage", "committee", "audit"]}
      title="Setup"
    />
  );
}
