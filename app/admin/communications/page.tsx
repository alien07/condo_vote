import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { EmailTableFilters } from "@/features/admin/components/admin-workspace";

type AdminCommunicationsPageProps = {
  searchParams: Promise<{
    created?: string;
    dir?: string;
    page?: string;
    perPage?: string;
    recipient?: string;
    sort?: string;
    status?: string;
  }>;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getEmailFilters(
  params: Awaited<AdminCommunicationsPageProps["searchParams"]>,
): EmailTableFilters {
  const sort =
    params.sort === "created" ||
    params.sort === "recipient" ||
    params.sort === "status"
      ? params.sort
      : "recipient";

  return {
    created: params.created,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    recipient: params.recipient,
    sort,
    status: params.status,
  };
}

export default async function AdminCommunicationsPage({
  searchParams,
}: AdminCommunicationsPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      description="Review mock email queue and delivery logs."
      emailFilters={getEmailFilters(params)}
      sections={["email"]}
      title="Communications"
    />
  );
}
