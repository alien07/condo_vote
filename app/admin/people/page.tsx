import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminPeoplePage() {
  return (
    <AdminWorkspace
      description="Rooms, owners, registered profiles, and role controls."
      sections={["people", "profiles"]}
      title="People"
    />
  );
}
