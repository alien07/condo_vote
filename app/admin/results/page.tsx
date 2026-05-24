import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminResultsPage() {
  return (
    <AdminWorkspace
      description="Generate result snapshots, approve results, and review locked state."
      sections={["results"]}
      title="Results"
    />
  );
}
