import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminVotingPageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    type?: string;
  }>;
};

export default async function AdminVotingPage({
  searchParams,
}: AdminVotingPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Import manual ballots and resolve manual/online vote conflicts."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      sections={["voting"]}
      title="Voting"
    />
  );
}
