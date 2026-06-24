import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { CommitteeTableFilters } from "@/features/admin/components/admin-workspace";
import type { AuditLogFilters } from "@/features/admin/data-modules/documents";

type AdminSetupPageProps = {
  searchParams: Promise<{
    actions?: string | string[];
    actor?: string;
    dir?: string;
    from?: string;
    focusCommitteeId?: string;
    id?: string;
    memberName?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    position?: string;
    sort?: string;
    status?: string;
    tab?: string;
    to?: string;
    type?: string;
  }>;
};

function getActions(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value?.split(",").filter(Boolean) ?? [];
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
    page: getPositiveInteger(params.page, 1),
    perPage: getPositiveInteger(params.perPage, 25),
    sortBy,
    sortDirection: params.dir === "asc" ? "asc" : "desc",
  };
}

function getCommitteeFilters(
  params: Awaited<AdminSetupPageProps["searchParams"]>,
): CommitteeTableFilters {
  const sort =
    params.sort === "name" ||
    params.sort === "position" ||
    params.sort === "status"
      ? params.sort
      : "name";

  return {
    dir: params.dir === "desc" ? "desc" : "asc",
    memberName: params.memberName,
    page: getPositiveInteger(params.page, 1),
    perPage: getPositiveInteger(params.perPage, 25),
    position: params.position,
    sort,
    status: params.status,
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
      committeeFilters={
        params.tab === "committee" ? getCommitteeFilters(params) : undefined
      }
      description="Juristic profile and committee setup for formal meeting documents."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      focusedCommitteeId={params.focusCommitteeId}
      sections={["setup", "storage", "committee", "audit"]}
      title="Setup"
    />
  );
}
