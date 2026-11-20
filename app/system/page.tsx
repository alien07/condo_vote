import { FolderLock, ShieldCheck, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { DocumentStorageSettingsForm } from "@/features/admin/components/setup-settings-forms";
import { PrivacySettingsForm } from "@/features/privacy/privacy-settings-form";
import { getPrivacySettings } from "@/features/privacy/service";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getI18n, getStaffI18n } from "@/lib/i18n/server";
import { getSystemAccessStatus, listSystemAdmins } from "@/features/system/access-service";
import { SystemAccessPanel, SystemAdminsPanel } from "@/features/system/system-access-panel";
import { NoticePeriodPanel } from "@/features/system/notice-period-panel";

// Technical, service, and maintenance settings for system admins (D016).
export default async function SystemPage() {
  const { roles } = await requireProfileWithRoles();

  if (!roles.includes("system_admin")) {
    redirect(DENIED_PATH);
  }

  const supabase = await createClient();
  const { locale, s } = await getStaffI18n();
  const t = s.system;
  const [privacySettings, appSettingsResult, accessStatus, systemAdmins] = await Promise.all([
    getPrivacySettings(supabase),
    supabase
      .from("app_settings")
      .select("id, document_storage_provider, document_storage_root, strict_notice_period")
      .order("created_at", { ascending: false })
      .limit(1),
    // req_0011 B (D027): temporary read-only access and the system admins.
    getSystemAccessStatus(supabase),
    listSystemAdmins(supabase),
  ]);

  if (appSettingsResult.error) {
    throw appSettingsResult.error;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Wrench className="text-[var(--primary)]" size={24} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t.intro}
          </p>
        </div>
      </div>

      <SystemAccessPanel locale={locale} status={accessStatus} t={t.access} />
      <SystemAdminsPanel admins={systemAdmins} roleNames={(await getI18n()).t.shell.roles} t={t.admins} />

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="text-[var(--primary)]" size={20} />
          <h2 className="text-lg font-semibold">{t.privacyTitle}</h2>
        </div>
        {privacySettings ? (
          <PrivacySettingsForm settings={privacySettings} />
        ) : (
          <p className="text-sm text-[var(--muted)]">{t.privacyMissing}</p>
        )}
      </section>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <FolderLock className="text-[var(--primary)]" size={20} />
          <h2 className="text-lg font-semibold">{t.storageTitle}</h2>
        </div>
        <DocumentStorageSettingsForm appSettings={appSettingsResult.data[0] ?? null} />
      </section>

      <NoticePeriodPanel days={(await supabase.rpc("notice_period_days")).data ?? 7} strict={appSettingsResult.data[0]?.strict_notice_period ?? false} t={t.notice} />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
        <h2 className="text-lg font-semibold">{t.emailTitle}</h2>
        <p className="mt-2 text-[var(--muted)]">
          {t.emailText}
        </p>
      </section>
    </main>
  );
}
