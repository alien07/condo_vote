import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import type { MeetingTableFilters } from "@/features/admin/components/admin-workspace";

type AdminMeetingsPageProps = {
  searchParams: Promise<{
    dir?: string;
    focusMeetingId?: string;
    focusQuestionId?: string;
    id?: string;
    mode?: string;
    noType?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    status?: string;
    tab?: string;
    title?: string;
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

function getMeetingFilters(
  params: Awaited<AdminMeetingsPageProps["searchParams"]>,
): MeetingTableFilters {
  const sort =
    params.sort === "no_type" ||
    params.sort === "status" ||
    params.sort === "title" ||
    params.sort === "window"
      ? params.sort
      : "title";

  return {
    dir: params.dir === "desc" ? "desc" : "asc",
    noType: params.noType,
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    sort,
    status: params.status,
    title: params.title,
  };
}

export default async function AdminMeetingsPage({
  searchParams,
}: AdminMeetingsPageProps) {
  const params = await searchParams;

  return (
    <AdminWorkspace
      activeSection={params.tab}
      description="Create meetings, configure agenda questions, and publish voting windows."
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      focusedMeetingId={params.focusMeetingId}
      focusedQuestionId={params.focusQuestionId}
      meetingFilters={getMeetingFilters(params)}
      sections={["meetings", "questions"]}
      title="Meetings"
    />
  );
}
