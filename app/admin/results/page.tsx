import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminResultsPageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    type?: string;
  }>;
};

export default async function AdminResultsPage({
  searchParams,
}: AdminResultsPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Generate result snapshots, approve results, and review locked state."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      sections={["results"]}
      title="Results"
    />
  );
}
