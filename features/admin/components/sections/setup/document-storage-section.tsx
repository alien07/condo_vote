import { getStaffI18n } from "@/lib/i18n/server";
import { FolderLock } from "lucide-react";
import { DocumentStorageSettingsForm } from "@/features/admin/components/setup-settings-forms";
import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";

type DocumentStorageSectionProps = Pick<AdminDashboardData, "appSettings"> & {
  canEdit: boolean;
  hidden: boolean;
};

export async function DocumentStorageSection({
  appSettings,
  canEdit,
  hidden,
}: DocumentStorageSectionProps) {
  const { s } = await getStaffI18n();

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="storage"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderLock className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.setup.storageTitle}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.setup.storageIntro}
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
          href="/admin/documents"
        >
          {s.setup.openDocuments}
        </a>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {s.setup.storageHelp}
      </p>

      {canEdit ? (
        <DocumentStorageSettingsForm appSettings={appSettings} />
      ) : (
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">{s.system.storageProvider}</dt>
            <dd className="font-medium">
              {appSettings?.document_storage_provider === "google_drive"
                ? s.system.googleDrive
                : s.system.localDrive}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{s.system.storageRoot}</dt>
            <dd className="font-medium break-all">
              {appSettings?.document_storage_root ?? "-"}
            </dd>
          </div>
          <p className="text-[var(--muted)] md:col-span-2">
            {s.setup.onlySystemAdmin}
          </p>
        </dl>
      )}
    </section>
  );
}
