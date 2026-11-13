import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import { CorrectionAdminPanel } from "@/features/committee/correction-admin-panel";
import { getStaffI18n } from "@/lib/i18n/server";
import type { ResultTableFilters } from "@/features/admin/components/admin-workspace";

// Approving can start the master PDF files (D021), which needs Chromium time.
export const maxDuration = 60;

type AdminResultsPageProps = {
  searchParams: Promise<{
    approval?: string;
    dir?: string;
    focusResultSnapshotId?: string;
    generated?: string;
    id?: string;
    meeting?: string;
    mode?: string;
    page?: string;
    perPage?: string;
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

function getResultFilters(
  params: Awaited<AdminResultsPageProps["searchParams"]>,
): ResultTableFilters {
  const sort =
    params.sort === "approval" ||
    params.sort === "generated" ||
    params.sort === "meeting"
      ? params.sort
      : "meeting";

  return {
    approval: params.approval,
    dir: params.dir === "desc" ? "desc" : "asc",
    generated: params.generated,
    meeting: params.meeting,
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    sort,
  };
}

export default async function AdminResultsPage({
  searchParams,
}: AdminResultsPageProps) {
  const { s } = await getStaffI18n();
  const params = await searchParams;

  return (
    <AdminWorkspace
      description={s.adminHome.pages.resultsText}
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      focusedResultSnapshotId={params.focusResultSnapshotId}
      intro={<CorrectionAdminPanel />}
      resultFilters={getResultFilters(params)}
      sections={["results"]}
      title={s.adminHome.pages.resultsTitle}
    />
  );
}
