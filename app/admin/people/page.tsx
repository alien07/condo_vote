import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminPeoplePageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    tab?: string;
    type?: string;
  }>;
};

export default async function AdminPeoplePage({
  searchParams,
}: AdminPeoplePageProps) {
  const params = await searchParams;
  const activeTab = !params.tab || params.tab === "people" ? "rooms" : params.tab;

  return (
    <AdminWorkspace
      activeSection={activeTab}
      description="Maintain room master data, owner records, and profile access roles. Use Ownership to link owners to rooms."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      sections={["rooms", "owners", "profiles"]}
      title="Rooms & Owners"
    />
  );
}
