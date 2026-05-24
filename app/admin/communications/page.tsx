import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminCommunicationsPage() {
  return (
    <AdminWorkspace
      description="Review mock email queue and delivery logs."
      sections={["email"]}
      title="Communications"
    />
  );
}
