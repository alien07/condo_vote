import { FolderLock, ShieldCheck, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { DocumentStorageSettingsForm } from "@/features/admin/components/setup-settings-forms";
import { PrivacySettingsForm } from "@/features/privacy/privacy-settings-form";
import { getPrivacySettings } from "@/features/privacy/service";
import { requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

// Technical, service, and maintenance settings for system admins (D016).
export default async function SystemPage() {
  const { roles } = await requireProfileWithRoles();

  if (!roles.includes("system_admin")) {
    redirect("/summary");
  }

  const supabase = await createClient();
  const [privacySettings, appSettingsResult] = await Promise.all([
    getPrivacySettings(supabase),
    supabase
      .from("app_settings")
      .select("id, document_storage_provider, document_storage_root")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (appSettingsResult.error) {
    throw appSettingsResult.error;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Wrench className="text-[var(--primary)]" size={24} />
        <div>
          <h1 className="text-2xl font-semibold">System</h1>
          <p className="text-sm text-[var(--muted)]">
            Technical settings. Meeting admins can view but not change these.
          </p>
        </div>
      </div>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="text-[var(--primary)]" size={20} />
          <h2 className="text-lg font-semibold">Privacy and PDPA</h2>
        </div>
        {privacySettings ? (
          <PrivacySettingsForm settings={privacySettings} />
        ) : (
          <p className="text-sm text-[var(--muted)]">Privacy settings are missing.</p>
        )}
      </section>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <FolderLock className="text-[var(--primary)]" size={20} />
          <h2 className="text-lg font-semibold">Document Storage</h2>
        </div>
        <DocumentStorageSettingsForm appSettings={appSettingsResult.data[0] ?? null} />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
        <h2 className="text-lg font-semibold">Email</h2>
        <p className="mt-2 text-[var(--muted)]">
          Email delivery uses Google SMTP. Its account and app password belong
          in the hosting environment variables, never in the database.
        </p>
      </section>
    </main>
  );
}
