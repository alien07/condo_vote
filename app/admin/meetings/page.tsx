import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminMeetingsPageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    tab?: string;
    type?: string;
  }>;
};

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
      sections={["meetings", "questions"]}
      title="Meetings"
    />
  );
}
