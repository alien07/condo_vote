import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import { getStaffI18n } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/auth/permissions";
import type { EmailTableFilters } from "@/features/admin/components/admin-workspace";

type AdminCommunicationsPageProps = {
  searchParams: Promise<{
    created?: string;
    dir?: string;
    focusEmailLogId?: string;
    id?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    recipient?: string;
    sort?: string;
    status?: string;
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
  // Manager only: office staff do data entry elsewhere (item 14c).
  await requireAdmin();
  const { s } = await getStaffI18n();
  const params = await searchParams;

  return (
    <AdminWorkspace
      description={s.adminHome.pages.communicationsText}
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      emailFilters={getEmailFilters(params)}
      focusedEmailLogId={params.focusEmailLogId}
      sections={["email"]}
      title={s.adminHome.pages.communicationsTitle}
    />
  );
}
