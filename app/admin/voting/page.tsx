import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { ManualVoteTableFilters } from "@/features/admin/components/admin-workspace";

type AdminVotingPageProps = {
  searchParams: Promise<{
    dir?: string;
    id?: string;
    meeting?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    room?: string;
    sort?: string;
    type?: string;
  }>;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getManualVoteFilters(
  params: Awaited<AdminVotingPageProps["searchParams"]>,
): ManualVoteTableFilters {
  const sort =
    params.sort === "meeting" ||
    params.sort === "question" ||
    params.sort === "room"
      ? params.sort
      : "meeting";

  return {
    dir: params.dir === "desc" ? "desc" : "asc",
    meeting: params.meeting,
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    room: params.room,
    sort,
  };
}

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
      manualVoteFilters={getManualVoteFilters(params)}
      sections={["voting"]}
      title="Voting"
    />
  );
}
