import { LogIn } from "lucide-react";
import { EmailLoginForm } from "@/features/auth/login-form";
import { signInWithGoogle } from "@/features/auth/actions";
import { APP_VERSION } from "@/lib/app-config";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <LogIn className="mb-4 text-[var(--primary)]" size={24} />
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Sign in with Google or email magic link. Version {APP_VERSION}.
        </p>
        <form action={signInWithGoogle} className="mt-5">
          <button
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
            type="submit"
          >
            Continue with Google
          </button>
        </form>
        <EmailLoginForm />
      </section>
    </main>
  );
}
