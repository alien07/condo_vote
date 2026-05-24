import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminVotingPage() {
  return (
    <AdminWorkspace
      description="Import manual ballots and resolve manual/online vote conflicts."
      sections={["voting"]}
      title="Voting"
    />
  );
}
