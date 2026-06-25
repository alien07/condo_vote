import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { ProxyTableFilters } from "@/features/admin/components/admin-workspace";

type AdminProxiesPageProps = {
  searchParams: Promise<{
    dir?: string;
    focusProxyId?: string;
    id?: string;
    meeting?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    proxy?: string;
    room?: string;
    sort?: string;
    type?: string;
  }>;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getProxyFilters(
  params: Awaited<AdminProxiesPageProps["searchParams"]>,
): ProxyTableFilters {
  const sort =
    params.sort === "meeting" ||
    params.sort === "owner" ||
    params.sort === "proxy" ||
    params.sort === "room" ||
    params.sort === "status"
      ? params.sort
      : "meeting";

  return {
    dir: params.dir === "desc" ? "desc" : "asc",
    meeting: params.meeting,
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    proxy: params.proxy,
    room: params.room,
    sort,
  };
}

export default async function AdminProxiesPage({
  searchParams,
}: AdminProxiesPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Create and review proxy authorizations for voting meetings."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      focusedProxyId={params.focusProxyId}
      proxyFilters={getProxyFilters(params)}
      sections={["proxies"]}
      title="Proxies"
    />
  );
}
