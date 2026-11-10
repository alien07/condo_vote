import { getStaffI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { MasterDataImportForms } from "@/features/admin/components/master-data-import-forms";

export default async function AdminPeopleImportPage() {
  const { s } = await getStaffI18n();
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <Link
            className="mb-4 inline-flex text-sm font-medium text-[var(--primary)]"
            href="/admin/people"
          >
            {s.people.backToPeople}
          </Link>
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
