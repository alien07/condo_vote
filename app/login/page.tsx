import { LogIn } from "lucide-react";
import { APP_VERSION } from "@/lib/app-config";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <LogIn className="mb-4 text-[var(--primary)]" size={24} />
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Supabase authentication will be connected after environment setup.
          Version {APP_VERSION}.
        </p>
      </section>
    </main>
  );
}
