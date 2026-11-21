import { getStaffI18n } from "@/lib/i18n/server";
import { BackLink } from "@/features/shell/back-link";
import { FileSpreadsheet } from "lucide-react";
import { MasterDataImportForms } from "@/features/admin/components/master-data-import-forms";
import { requireOfficeStaff } from "@/lib/auth/permissions";

// Manager or office staff, like the import actions (requireOfficeStaff);
// read only for a System Admin's temporary access, whose imports are refused.
export default async function AdminPeopleImportPage() {
  await requireOfficeStaff({ readOnly: true });
  const { s } = await getStaffI18n();
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <BackLink className="mb-4" href="/admin/people">
            {s.people.backToPeople}
          </BackLink>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">
                {s.people.importTitle}
              </h1>
              <p className="text-sm text-[var(--muted)]">
                {s.people.importIntro}
              </p>
            </div>
          </div>
        </div>

        <MasterDataImportForms />
      </section>
    </main>
  );
}
