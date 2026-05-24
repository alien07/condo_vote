import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminOwnershipPage() {
  return (
    <AdminWorkspace
      description="Link owners to rooms and maintain effective ownership dates."
      sections={["ownership"]}
      title="Ownership"
    />
  );
}
