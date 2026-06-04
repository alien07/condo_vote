import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { MasterDataImportForms } from "@/features/admin/components/admin-workspace";

export default function AdminPeopleImportPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <Link
            className="mb-4 inline-flex text-sm font-medium text-[var(--primary)]"
            href="/admin/people"
          >
            Back to People
          </Link>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">
                Excel Import Master Data
              </h1>
              <p className="text-sm text-[var(--muted)]">
                Download the locked Excel template for each master table, edit
                only the input rows, then upload the same .xlsx file. Imports
                are upserts only; deletion stays in the edit/update menus.
              </p>
            </div>
          </div>
        </div>

        <MasterDataImportForms />
      </section>
    </main>
  );
}
