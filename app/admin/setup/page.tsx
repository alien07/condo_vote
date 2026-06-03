import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminSetupPage() {
  return (
    <AdminWorkspace
      description="Juristic profile and committee setup for formal meeting documents."
      sections={["setup", "storage", "committee", "audit"]}
      title="Setup"
    />
  );
}
