import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import { acceptPrivacyNotice } from "@/features/privacy/actions";
import { getPrivacySettings, needsPrivacyConsent } from "@/features/privacy/service";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { getI18n } from "@/lib/i18n/server";

type ConsentPageProps = {
  searchParams: Promise<{ changed?: string }>;
};

// PDPA consent at registration and whenever the notice changes (D016).
export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();

  if (!(await needsPrivacyConsent(supabase))) {
    redirect("/");
  }

  const settings = await getPrivacySettings(supabase);
  const { locale, t: dict } = await getI18n();
  const t = dict.consent;
  // Thai is the notice of record; English falls back to it when empty.
  const noticeText =
    locale === "en" && settings?.notice_text_en ? settings.notice_text_en : settings?.notice_text;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10" lang={locale}>
      <section className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <ShieldCheck className="text-[var(--primary)]" size={24} />
          <LanguageSwitcher locale={locale} />
        </div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t.intro(settings?.notice_version ?? 1)}
        </p>
        {params.changed ? (
          <p
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            role="alert"
          >
            {t.changed}
          </p>
        ) : null}
        <div className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-4 text-sm leading-6">
          {noticeText}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <form action={acceptPrivacyNotice}>
            <input
              name="notice_version"
              type="hidden"
              value={settings?.notice_version ?? 1}
            />
            <PendingSubmitButton
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] sm:w-auto"
              pendingLabel={t.saving}
              type="submit"
            >
              {t.accept}
            </PendingSubmitButton>
          </form>
          <form action={signOut}>
            <button
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium sm:w-auto"
              type="submit"
            >
              {t.decline}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
