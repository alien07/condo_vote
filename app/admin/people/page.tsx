import { AdminWorkspace } from "@/features/admin/components/admin-workspace";
import { getStaffI18n } from "@/lib/i18n/server";

type AdminPeoplePageProps = {
  searchParams: Promise<{
    id?: string;
    mode?: string;
    tab?: string;
    type?: string;
  }>;
};

export default async function AdminPeoplePage({
  searchParams,
}: AdminPeoplePageProps) {
  const { s } = await getStaffI18n();
  const params = await searchParams;
  const activeTab = !params.tab || params.tab === "people" ? "rooms" : params.tab;

  return (
    <AdminWorkspace
      activeSection={activeTab}
      description={s.adminHome.pages.peopleText}
      drawer={{
        id: params.id,
        mode: params.mode,
        type: params.type,
      }}
      sections={["rooms", "owners", "profiles"]}
      title={s.adminHome.pages.peopleTitle}
    />
  );
}
