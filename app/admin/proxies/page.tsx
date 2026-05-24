import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminProxiesPage() {
  return (
    <AdminWorkspace
      description="Create and review proxy authorizations for voting meetings."
      sections={["proxies"]}
      title="Proxies"
    />
  );
}
