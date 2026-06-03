import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminPeoplePageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function AdminPeoplePage({
  searchParams,
}: AdminPeoplePageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      activeSection={params.tab}
      description="Rooms, owners, registered profiles, and role controls."
      sections={["people", "profiles"]}
      title="People"
    />
  );
}
