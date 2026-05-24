import { AdminWorkspace } from "@/features/admin/components/admin-workspace";

export default function AdminMeetingsPage() {
  return (
    <AdminWorkspace
      description="Create meetings, configure agenda questions, and publish voting windows."
      sections={["meetings", "questions"]}
      title="Meetings"
    />
  );
}
