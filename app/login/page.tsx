import { LogIn } from "lucide-react";
import {
  isLocalAuthBypassAvailable,
  signInWithGoogle,
} from "@/features/auth/actions";
import { GoogleLoginForm } from "@/features/auth/google-login-form";
import { ERROR_CODES } from "@/lib/error-codes";
import { APP_VERSION } from "@/lib/app-config";

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

function getLoginErrorMessage(error: string | undefined) {
  switch (error) {
    case ERROR_CODES.AUTH_MISSING_ORIGIN:
      return "Sign-in failed: missing request origin.";
    case ERROR_CODES.AUTH_GOOGLE_PROVIDER:
      return "Sign-in failed: Google provider is not ready.";
    case ERROR_CODES.AUTH_GOOGLE_REDIRECT_MISSING:
      return "Sign-in failed: Google did not return a redirect URL.";
    case ERROR_CODES.AUTH_CALLBACK_MISSING_TOKEN:
      return "Sign-in failed: callback is missing an auth token.";
    case ERROR_CODES.AUTH_CALLBACK_EXCHANGE_FAILED:
      return "Sign-in failed: callback token exchange failed.";
    case ERROR_CODES.AUTH_CALLBACK_USER_MISSING:
      return "Sign-in failed: no authenticated user was returned.";
    case ERROR_CODES.AUTH_CALLBACK_PROFILE_FAILED:
      return "Sign-in failed: could not create or load your profile.";
    case ERROR_CODES.AUTH_LOCAL_BYPASS_DISABLED:
      return "Local demo sign-in is available only in local development.";
    case ERROR_CODES.AUTH_LOCAL_BYPASS_FAILED:
      return "Local demo sign-in failed. Check the local Supabase service key and auth logs.";
    default:
      return error ? `Sign-in failed: ${error}.` : null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeNext(params.next);
  const errorMessage = getLoginErrorMessage(params.error);
  const canUseLocalBypass = await isLocalAuthBypassAvailable();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <LogIn className="mb-4 text-[var(--primary)]" size={24} />
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Sign in with Google. Version {APP_VERSION}.
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="block font-medium">{params.error}</span>
            <span>{errorMessage}</span>
          </p>
        ) : null}
        <GoogleLoginForm action={signInWithGoogle} next={next} />
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
      </section>
    </main>
  );
}
