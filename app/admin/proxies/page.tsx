import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminProxiesPageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    type?: string;
  }>;
};

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
      sections={["proxies"]}
      title="Proxies"
    />
  );
}
