import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminOwnershipPageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    type?: string;
  }>;
};

export default async function AdminOwnershipPage({
  searchParams,
}: AdminOwnershipPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Link owners to rooms and maintain effective ownership dates."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      sections={["ownership"]}
      title="Ownership"
    />
  );
}
