import { LogIn } from "lucide-react";
import { signInWithGoogle } from "@/features/auth/actions";
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
      return "Login failed: missing request origin.";
    case ERROR_CODES.AUTH_GOOGLE_PROVIDER:
      return "Login failed: Google provider is not ready.";
    case ERROR_CODES.AUTH_GOOGLE_REDIRECT_MISSING:
      return "Login failed: Google did not return a redirect URL.";
    case ERROR_CODES.AUTH_CALLBACK_MISSING_TOKEN:
      return "Login failed: callback is missing an auth token.";
    case ERROR_CODES.AUTH_CALLBACK_EXCHANGE_FAILED:
      return "Login failed: callback token exchange failed.";
    case ERROR_CODES.AUTH_CALLBACK_USER_MISSING:
      return "Login failed: no authenticated user was returned.";
    case ERROR_CODES.AUTH_CALLBACK_PROFILE_FAILED:
      return "Login failed: could not create or load your profile.";
    default:
      return error ? `Login failed: ${error}.` : null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeNext(params.next);
  const errorMessage = getLoginErrorMessage(params.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <LogIn className="mb-4 text-[var(--primary)]" size={24} />
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Sign in with Google. Version {APP_VERSION}.
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="block font-medium">{params.error}</span>
            <span>{errorMessage}</span>
          </p>
        ) : null}
        <form action={signInWithGoogle} className="mt-5">
          <input name="next" type="hidden" value={next} />
          <button
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
            type="submit"
          >
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
