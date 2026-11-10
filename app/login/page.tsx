import { LogIn } from "lucide-react";
import {
  isLocalAuthBypassAvailable,
  signInWithGoogle,
} from "@/features/auth/actions";
import { GoogleLoginForm } from "@/features/auth/google-login-form";
import { ERROR_CODES } from "@/lib/error-codes";
import { APP_VERSION } from "@/lib/app-config";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

function getSafeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

function getLoginErrorMessage(error: string | undefined, t: Dictionary["login"]) {
  switch (error) {
    case ERROR_CODES.AUTH_MISSING_ORIGIN:
      return t.errors.missingOrigin;
    case ERROR_CODES.AUTH_GOOGLE_PROVIDER:
      return t.errors.googleProvider;
    case ERROR_CODES.AUTH_GOOGLE_REDIRECT_MISSING:
      return t.errors.googleRedirect;
    case ERROR_CODES.AUTH_CALLBACK_MISSING_TOKEN:
      return t.errors.callbackToken;
    case ERROR_CODES.AUTH_CALLBACK_EXCHANGE_FAILED:
      return t.errors.callbackExchange;
    case ERROR_CODES.AUTH_CALLBACK_USER_MISSING:
      return t.errors.callbackUser;
    case ERROR_CODES.AUTH_CALLBACK_PROFILE_FAILED:
      return t.errors.callbackProfile;
    case ERROR_CODES.AUTH_LOCAL_BYPASS_DISABLED:
      return "Local demo sign-in is available only in local development.";
    case ERROR_CODES.AUTH_LOCAL_BYPASS_FAILED:
      return "Local demo sign-in failed. Check the local Supabase service key and auth logs.";
    default:
      return error ? `${t.failed}: ${error}` : null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeNext(params.next);
  const { locale, t: dict } = await getI18n();
  const t = dict.login;
  const errorMessage = getLoginErrorMessage(params.error, t);
  const canUseLocalBypass = await isLocalAuthBypassAvailable();

  return (
    <main className="flex min-h-screen items-center justify-center px-6" lang={locale}>
      <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <LogIn className="text-[var(--primary)]" size={24} />
          <LanguageSwitcher locale={locale} />
        </div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {t.intro}
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="block font-medium">{params.error}</span>
            <span>{errorMessage}</span>
          </p>
        ) : null}
        <GoogleLoginForm
          action={signInWithGoogle}
          label={t.google}
          next={next}
          pendingLabel={t.signingIn}
        />
        {canUseLocalBypass ? (
          <div className="mt-3">
            <a
              className="block w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900"
              href={`/auth/local-demo?next=${encodeURIComponent(next)}`}
            >
              Local demo sign in
            </a>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Development only. Uses the local demo admin account without Google.
            </p>
          </div>
        ) : null}
        <p className="mt-6 text-xs text-[var(--muted)]">
          {t.version} {APP_VERSION}
        </p>
      </section>
    </main>
  );
}
