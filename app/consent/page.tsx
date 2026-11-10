import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import { acceptPrivacyNotice } from "@/features/privacy/actions";
import { getPrivacySettings, needsPrivacyConsent } from "@/features/privacy/service";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <ShieldCheck className="mb-4 text-[var(--primary)]" size={24} />
        <h1 className="text-xl font-semibold">Privacy Notice</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Please read and accept before using the voting system. Version{" "}
          {settings?.notice_version ?? 1}.
        </p>
        {params.changed ? (
          <p
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            role="alert"
          >
            The privacy notice was updated. Please read the new version.
          </p>
        ) : null}
        <div className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-4 text-sm leading-6">
          {settings?.notice_text}
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
              pendingLabel="Saving..."
              type="submit"
            >
              I accept
            </PendingSubmitButton>
          </form>
          <form action={signOut}>
            <button
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium sm:w-auto"
              type="submit"
            >
              Decline and sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
