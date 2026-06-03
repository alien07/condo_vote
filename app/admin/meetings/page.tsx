import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

type AdminMeetingsPageProps = {
  searchParams: Promise<{
    tab?: string;
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
      sections={["meetings", "questions"]}
      title="Meetings"
    />
  );
}
