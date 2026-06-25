import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminOwnershipPageProps = {
  searchParams: Promise<{
    dir?: string;
    focusOwnershipId?: string;
    id?: string;
    mode?: string;
    owner?: string;
    page?: string;
    perPage?: string;
    room?: string;
    sort?: string;
    status?: string;
    type?: string;
  }>;
};

function ownershipCreateHref(
  params: Awaited<AdminOwnershipPageProps["searchParams"]>,
) {
  const query = new URLSearchParams();

  for (const key of ["dir", "owner", "page", "perPage", "room", "sort", "status"]) {
    const value = params[key as keyof typeof params];

    if (value) {
      query.set(key, value);
    }
  }

  query.set("mode", "create");
  query.set("type", "ownership_link");

  return `/admin/ownership?${query.toString()}`;
}

export default async function AdminOwnershipPage({
  searchParams,
}: AdminOwnershipPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Link owners to rooms and maintain effective ownership dates."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      ownershipCreateHref={ownershipCreateHref(params)}
      sections={["ownership"]}
      title="Ownership"
    />
  );
}
