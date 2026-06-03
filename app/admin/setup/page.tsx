import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminSetupPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function AdminSetupPage({
  searchParams,
}: AdminSetupPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      activeSection={params.tab}
      description="Juristic profile and committee setup for formal meeting documents."
      sections={["setup", "storage", "committee", "audit"]}
      title="Setup"
    />
  );
}
